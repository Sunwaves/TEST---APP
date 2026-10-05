import type { Appointment, Business, Client, Message, PrismaClient, Service } from "@prisma/client";
import { formatDayLabel } from "../format";
import { toZonedHHMM, toZonedIsoDate } from "../time";
import { send } from "./drivers";
import { DEFAULT_TEMPLATES, renderTemplate, type TemplateKind } from "./templates";

// Decides which messages an appointment event produces, queues them, and delivers due ones.
// Message bodies are rendered when queued, so reminders sent later still carry the right link.

type Full = Appointment & { business: Business; client: Client; service: Service };

const SUBJECTS: Record<TemplateKind, string> = {
  confirmation: "Booking confirmed: {service} on {date}",
  reminder: "Reminder: {service} on {date} at {time}",
  cancellation: "Cancelled: {service} on {date}",
  reschedule: "New time: {service} on {date} at {time}",
};

const TEMPLATE_FIELD: Record<TemplateKind, keyof Business> = {
  confirmation: "confirmationTemplate",
  reminder: "reminderTemplate",
  cancellation: "cancellationTemplate",
  reschedule: "rescheduleTemplate",
};

async function load(db: PrismaClient, appointmentId: string): Promise<Full> {
  return db.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: { business: true, client: true, service: true },
  });
}

export function messageVars(a: Full, origin: string): Record<string, string> {
  const tz = a.business.timezone;
  return {
    client: a.client.name.split(" ")[0],
    service: a.service.name,
    date: formatDayLabel(toZonedIsoDate(a.startsAt, tz), { weekday: "long", day: "numeric", month: "long" }),
    time: toZonedHHMM(a.startsAt, tz),
    business: a.business.name,
    address: a.business.address ?? "",
    phone: a.business.phone ?? "",
    link: a.manageToken ? `${origin}/booking/${a.manageToken}` : `${origin}/book/${a.business.slug}`,
    bookingPage: `${origin}/book/${a.business.slug}`,
  };
}

/** Queues the client message of `kind` on every channel we have for them. */
async function queueForClient(db: PrismaClient, a: Full, kind: TemplateKind, origin: string, sendAt = new Date()) {
  const vars = messageVars(a, origin);
  const template = (a.business[TEMPLATE_FIELD[kind]] as string | null) || DEFAULT_TEMPLATES[kind];
  const body = renderTemplate(template, vars);
  const subject = renderTemplate(SUBJECTS[kind], vars);
  const base = { businessId: a.businessId, appointmentId: a.id, kind: kind.toUpperCase(), body, sendAt };
  const rows = [
    ...(a.client.email ? [{ ...base, channel: "EMAIL", recipient: a.client.email, subject }] : []),
    ...(a.client.phone ? [{ ...base, channel: "SMS", recipient: a.client.phone }] : []),
  ];
  if (rows.length) await db.message.createMany({ data: rows });
}

async function queueReminder(db: PrismaClient, a: Full, origin: string, now: Date) {
  if (!a.business.remindersEnabled) return;
  const sendAt = new Date(a.startsAt.getTime() - a.business.reminderHoursBefore * 60 * 60 * 1000);
  // Booked inside the reminder window: the confirmation already does the job.
  if (sendAt <= now) return;
  await queueForClient(db, a, "reminder", origin, sendAt);
}

async function skipPendingReminders(db: PrismaClient, appointmentId: string) {
  await db.message.updateMany({
    where: { appointmentId, kind: "REMINDER", status: "QUEUED" },
    data: { status: "SKIPPED", error: "Appointment changed" },
  });
}

async function alertBusiness(db: PrismaClient, a: Full, kind: "NEW_BOOKING_ALERT" | "CANCELLATION_ALERT", origin: string) {
  if (!a.business.notifyEmail) return;
  const v = messageVars(a, origin);
  const what = kind === "NEW_BOOKING_ALERT" ? "New online booking" : "Client cancelled";
  await db.message.create({
    data: {
      businessId: a.businessId,
      appointmentId: a.id,
      kind,
      channel: "EMAIL",
      recipient: a.business.notifyEmail,
      subject: `${what}: ${a.client.name}, ${v.service} on ${v.date} at ${v.time}`,
      body: `${what}.\n\nClient: ${a.client.name}${a.client.phone ? `, ${a.client.phone}` : ""}${a.client.email ? `, ${a.client.email}` : ""}\nService: ${v.service}\nWhen: ${v.date} at ${v.time}\n\nOpen in dashboard: ${origin}/dashboard/appointments/${a.id}`,
    },
  });
}

export async function notifyBooked(db: PrismaClient, appointmentId: string, origin: string, now = new Date()) {
  const a = await load(db, appointmentId);
  await queueForClient(db, a, "confirmation", origin);
  await queueReminder(db, a, origin, now);
  if (a.source === "ONLINE") await alertBusiness(db, a, "NEW_BOOKING_ALERT", origin);
}

export async function notifyCancelled(db: PrismaClient, appointmentId: string, origin: string, opts: { byClient: boolean }) {
  const a = await load(db, appointmentId);
  await skipPendingReminders(db, a.id);
  await queueForClient(db, a, "cancellation", origin);
  if (opts.byClient) await alertBusiness(db, a, "CANCELLATION_ALERT", origin);
}

export async function notifyRescheduled(db: PrismaClient, appointmentId: string, origin: string, now = new Date()) {
  const a = await load(db, appointmentId);
  await skipPendingReminders(db, a.id);
  await queueForClient(db, a, "reschedule", origin);
  await queueReminder(db, a, origin, now);
}

/** Routes a staff status change to the right notification. */
export async function notifyStatusChange(db: PrismaClient, appointmentId: string, from: string, to: string, origin: string) {
  if (from === to) return;
  if (to === "CANCELLED") return notifyCancelled(db, appointmentId, origin, { byClient: false });
  if (to === "BOOKED" && from === "CANCELLED") return notifyBooked(db, appointmentId, origin);
  if (to === "COMPLETED" || to === "NO_SHOW") return notifyClosed(db, appointmentId);
}

/** Completed / no-show: nothing to send, but pending reminders must not go out. */
export async function notifyClosed(db: PrismaClient, appointmentId: string) {
  await skipPendingReminders(db, appointmentId);
}

export async function queuePasswordReset(db: PrismaClient, user: { email: string; businessId: string; name: string }, link: string) {
  await db.message.create({
    data: {
      businessId: user.businessId,
      kind: "PASSWORD_RESET",
      channel: "EMAIL",
      recipient: user.email,
      subject: "Reset your password",
      body: `Hi ${user.name.split(" ")[0]},\n\nUse this link within an hour to choose a new password:\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
    },
  });
}

/**
 * Sends every queued message that is due. Each message is claimed first,
 * so overlapping runs (timer + cron) never send the same one twice.
 */
export async function deliverDue(db: PrismaClient, now = new Date(), limit = 50): Promise<{ sent: number; failed: number }> {
  const due = await db.message.findMany({
    where: { status: "QUEUED", sendAt: { lte: now } },
    orderBy: { sendAt: "asc" },
    take: limit,
    include: { appointment: { select: { status: true } } },
  });
  let sent = 0;
  let failed = 0;
  for (const m of due) {
    const { count } = await db.message.updateMany({ where: { id: m.id, status: "QUEUED" }, data: { status: "SENDING" } });
    if (!count) continue;
    // Safety net: never remind about an appointment that is no longer booked.
    if (m.kind === "REMINDER" && m.appointment && m.appointment.status !== "BOOKED") {
      await db.message.update({ where: { id: m.id }, data: { status: "SKIPPED", error: "Appointment no longer booked" } });
      continue;
    }
    try {
      await send(m as Message & { channel: "EMAIL" | "SMS" });
      await db.message.update({ where: { id: m.id }, data: { status: "SENT", sentAt: new Date(), error: null } });
      sent++;
    } catch (err) {
      await db.message.update({ where: { id: m.id }, data: { status: "FAILED", error: String((err as Error).message ?? err).slice(0, 500) } });
      failed++;
    }
  }
  return { sent, failed };
}
