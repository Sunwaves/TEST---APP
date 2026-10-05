import { randomBytes } from "node:crypto";
import type { Business, Prisma, PrismaClient } from "@prisma/client";
import { availableSlots } from "./availability";
import { addMinutes, toZonedIsoDate, weekdayOf, zonedTimeToUtc } from "./time";

type Db = PrismaClient | Prisma.TransactionClient;

export class BookingError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
  }
}

/** Appointments that still block time on the calendar. */
const BLOCKING = { status: { in: ["BOOKED", "COMPLETED"] } };

export async function getSlots(db: Db, businessId: string, serviceId: string, date: string, now = new Date()) {
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });
  const service = await db.service.findFirst({ where: { id: serviceId, businessId, active: true } });
  if (!service) throw new BookingError("Service not found", 404);

  const windows = await db.workingHours.findMany({ where: { businessId, weekday: weekdayOf(date) } });
  const dayStart = zonedTimeToUtc(date, "00:00", business.timezone);
  const dayEnd = addMinutes(dayStart, 24 * 60 + 60); // a little slack for DST-length days
  const busy = await db.appointment.findMany({
    where: { businessId, ...BLOCKING, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
    select: { startsAt: true, endsAt: true },
  });

  return availableSlots({
    date,
    timezone: business.timezone,
    windows,
    busy: busy.map((a) => ({ start: a.startsAt, end: a.endsAt })),
    durationMinutes: service.durationMinutes,
    bufferMinutes: service.bufferMinutes,
    stepMinutes: business.slotStepMinutes,
    minNoticeMinutes: business.minNoticeMinutes,
    now,
  });
}

export interface BookInput {
  serviceId: string;
  startsAt: Date;
  notes?: string;
  clientId?: string;
  client?: { name: string; phone?: string; email?: string; notes?: string };
  source: "STAFF" | "ONLINE";
}

/**
 * Creates an appointment. Online bookings must land on an advertised slot;
 * staff bookings may be placed anywhere that doesn't double-book.
 */
export async function bookAppointment(db: PrismaClient, businessId: string, input: BookInput, now = new Date()) {
  return db.$transaction(async (tx) => {
    const business = await tx.business.findUniqueOrThrow({ where: { id: businessId } });
    const service = await tx.service.findFirst({ where: { id: input.serviceId, businessId, active: true } });
    if (!service) throw new BookingError("Service not found", 404);

    const startsAt = input.startsAt;
    const endsAt = addMinutes(startsAt, service.durationMinutes + service.bufferMinutes);

    if (input.source === "ONLINE") {
      const date = toZonedIsoDate(startsAt, business.timezone);
      const slots = await onlineSlots(tx, business, service.id, date, now);
      if (!slots.some((s) => s.getTime() === startsAt.getTime())) {
        throw new BookingError("That time is no longer available", 409);
      }
    } else {
      const clash = await tx.appointment.findFirst({
        where: { businessId, ...BLOCKING, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      });
      if (clash) throw new BookingError("That time overlaps another appointment", 409);
    }

    let clientId = input.clientId;
    if (clientId) {
      const client = await tx.client.findFirst({ where: { id: clientId, businessId } });
      if (!client) throw new BookingError("Client not found", 404);
    } else if (input.client) {
      const returning = input.source === "ONLINE" ? await findReturningClient(tx, businessId, input.client) : null;
      clientId = returning?.id ?? (await tx.client.create({ data: { ...input.client, businessId } })).id;
    } else {
      throw new BookingError("Provide clientId or client");
    }

    return tx.appointment.create({
      data: {
        businessId,
        serviceId: service.id,
        clientId,
        startsAt,
        endsAt,
        notes: input.notes,
        source: input.source,
        manageToken: newManageToken(),
      },
      include: { service: true, client: true },
    });
  });
}

function newManageToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Online bookers are matched to an existing client by email, then phone, so history stays in one place. */
async function findReturningClient(db: Db, businessId: string, client: { email?: string; phone?: string }) {
  if (client.email) {
    const byEmail = await db.client.findFirst({ where: { businessId, email: client.email } });
    if (byEmail) return byEmail;
  }
  if (client.phone) return db.client.findFirst({ where: { businessId, phone: client.phone } });
  return null;
}

/** The days clients may book online: today through `maxAdvanceDays` ahead, in the business timezone. */
export function bookingWindow(business: Pick<Business, "timezone" | "maxAdvanceDays">, now = new Date()) {
  const first = toZonedIsoDate(now, business.timezone);
  const last = toZonedIsoDate(addMinutes(now, business.maxAdvanceDays * 24 * 60), business.timezone);
  return { first, last };
}

/** Slots offered on the public booking page: like getSlots, but limited to the booking window. */
export async function onlineSlots(db: Db, business: Business, serviceId: string, date: string, now = new Date()) {
  const { first, last } = bookingWindow(business, now);
  if (date < first || date > last) return [];
  return getSlots(db, business.id, serviceId, date, now);
}

/** Client self-service cancellation through the manage link. Allowed until the appointment starts. */
export async function cancelByToken(db: PrismaClient, token: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({ where: { manageToken: token } });
    if (!appointment) throw new BookingError("Booking not found", 404);
    if (appointment.status !== "BOOKED") throw new BookingError("This booking can no longer be cancelled");
    if (appointment.startsAt <= now) throw new BookingError("This appointment has already started");
    return tx.appointment.update({
      where: { id: appointment.id },
      data: { status: "CANCELLED" },
      include: { service: true, client: true, business: true },
    });
  });
}

export async function updateAppointment(
  db: PrismaClient,
  businessId: string,
  id: string,
  data: { status?: string; notes?: string },
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.appointment.findFirst({ where: { id, businessId } });
    if (!existing) throw new BookingError("Appointment not found", 404);

    // Reinstating a cancelled/no-show appointment must not double-book the slot.
    const blocking = BLOCKING.status.in;
    if (data.status && blocking.includes(data.status) && !blocking.includes(existing.status)) {
      const clash = await tx.appointment.findFirst({
        where: { businessId, id: { not: id }, ...BLOCKING, startsAt: { lt: existing.endsAt }, endsAt: { gt: existing.startsAt } },
      });
      if (clash) throw new BookingError("That time overlaps another appointment", 409);
    }

    return tx.appointment.update({ where: { id }, data, include: { service: true, client: true } });
  });
}

/** Moves an appointment (staff action): keeps its length, refuses overlaps. */
export async function rescheduleAppointment(db: PrismaClient, businessId: string, id: string, startsAt: Date) {
  return db.$transaction(async (tx) => {
    const existing = await tx.appointment.findFirst({ where: { id, businessId } });
    if (!existing) throw new BookingError("Appointment not found", 404);
    if (existing.status !== "BOOKED") {
      throw new BookingError("Only booked appointments can be moved");
    }

    const length = existing.endsAt.getTime() - existing.startsAt.getTime();
    const endsAt = new Date(startsAt.getTime() + length);
    const clash = await tx.appointment.findFirst({
      where: { businessId, id: { not: id }, ...BLOCKING, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    });
    if (clash) throw new BookingError("That time overlaps another appointment", 409);

    return tx.appointment.update({ where: { id }, data: { startsAt, endsAt }, include: { service: true, client: true } });
  });
}

export interface HoursInput {
  weekday: number;
  startTime: string;
  endTime: string;
}

/** Replaces the weekly opening hours. Windows must be non-empty and not overlap within a day. */
export async function setWorkingHours(db: PrismaClient, businessId: string, hours: HoursInput[]) {
  const problem = workingHoursProblem(hours);
  if (problem) throw new BookingError(problem);
  return db.$transaction(async (tx) => {
    await tx.workingHours.deleteMany({ where: { businessId } });
    await tx.workingHours.createMany({ data: hours.map((h) => ({ ...h, businessId })) });
    return tx.workingHours.findMany({ where: { businessId }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] });
  });
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Returns a human-readable problem with the hours, or null if they are valid. */
export function workingHoursProblem(hours: HoursInput[]): string | null {
  for (let day = 0; day < 7; day++) {
    const windows = hours
      .filter((h) => h.weekday === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (const [i, w] of windows.entries()) {
      if (w.startTime >= w.endTime) return `${WEEKDAY_NAMES[day]}: ${w.startTime}–${w.endTime} ends before it starts`;
      const next = windows[i + 1];
      if (next && next.startTime < w.endTime) return `${WEEKDAY_NAMES[day]}: opening hours overlap`;
    }
  }
  return null;
}
