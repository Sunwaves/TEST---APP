import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bookAppointment, rescheduleAppointment, updateAppointment } from "./booking";
import { deliverDue, notifyBooked, notifyCancelled, notifyRescheduled, notifyStatusChange } from "./messages/notify";
import { renderTemplate } from "./messages/templates";

const db = new PrismaClient();
const origin = "https://salon.test";
const now = new Date("2026-12-01T00:00:00Z");
const at = (iso: string) => new Date(`2026-12-07T${iso}:00Z`); // Monday, London = UTC
let businessId: string;
let serviceId: string;

beforeEach(async () => {
  await db.business.deleteMany();
  const business = await db.business.create({
    data: {
      name: "Glow",
      slug: "glow",
      minNoticeMinutes: 0,
      notifyEmail: "owner@glow.test",
      proUntil: new Date("2030-01-01T00:00:00Z"), // PRO: clients get SMS as well as email
      workingHours: { create: [{ weekday: 1, startTime: "09:00", endTime: "17:00" }] },
    },
  });
  businessId = business.id;
  serviceId = (await db.service.create({ data: { businessId, name: "Cut", durationMinutes: 60, priceCents: 3000 } })).id;
});
afterAll(() => db.$disconnect());

const book = (source: "ONLINE" | "STAFF", client = { name: "Ana Pop", email: "ana@example.com", phone: "07700900001" }) =>
  bookAppointment(db, businessId, { serviceId, startsAt: at("10:00"), source, client }, now);
const messages = () => db.message.findMany({ orderBy: [{ sendAt: "asc" }, { kind: "asc" }, { channel: "asc" }] });

describe("templates", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(renderTemplate("Hi {client}, see you at {time} {oops}", { client: "Ana", time: "10:00" })).toBe("Hi Ana, see you at 10:00 {oops}");
  });
});

describe("notifications", () => {
  it("online booking: confirmation by email and SMS, a reminder 24h before, and an alert to the salon", async () => {
    const a = await book("ONLINE");
    await notifyBooked(db, a.id, origin, now);
    const all = await messages();

    const confirmations = all.filter((m) => m.kind === "CONFIRMATION");
    expect(confirmations.map((m) => m.channel).sort()).toEqual(["EMAIL", "SMS"]);
    expect(confirmations[0].body).toBe(
      `Hi Ana, your Cut at Glow is booked for Monday 7 December at 10:00. View or cancel: ${origin}/booking/${a.manageToken}`,
    );
    expect(confirmations.find((m) => m.channel === "EMAIL")?.subject).toBe("Booking confirmed: Cut on Monday 7 December");

    const reminders = all.filter((m) => m.kind === "REMINDER");
    expect(reminders).toHaveLength(2);
    expect(reminders[0].sendAt.toISOString()).toBe("2026-12-06T10:00:00.000Z");

    const alert = all.find((m) => m.kind === "NEW_BOOKING_ALERT");
    expect(alert?.recipient).toBe("owner@glow.test");
    expect(alert?.body).toContain(`${origin}/dashboard/appointments/${a.id}`);
  });

  it("staff booking: no salon alert; uses custom templates; skips channels the client lacks", async () => {
    await db.business.update({ where: { id: businessId }, data: { confirmationTemplate: "See you {date}, {client}!" } });
    const a = await book("STAFF", { name: "Ben", email: "", phone: "07700900002" } as never);
    await notifyBooked(db, a.id, origin, now);
    const all = await messages();
    expect(all.some((m) => m.kind === "NEW_BOOKING_ALERT")).toBe(false);
    expect(all.filter((m) => m.kind === "CONFIRMATION").map((m) => [m.channel, m.body])).toEqual([["SMS", "See you Monday 7 December, Ben!"]]);
  });

  it("no reminder when reminders are off or the booking is inside the reminder window", async () => {
    const a = await book("STAFF");
    await notifyBooked(db, a.id, origin, new Date("2026-12-06T12:00:00Z")); // 22h before
    await db.business.update({ where: { id: businessId }, data: { remindersEnabled: false } });
    await notifyBooked(db, a.id, origin, now);
    expect((await messages()).some((m) => m.kind === "REMINDER")).toBe(false);
  });

  it("cancelling skips the reminder, tells the client, and alerts the salon only when the client cancelled", async () => {
    const a = await book("ONLINE");
    await notifyBooked(db, a.id, origin, now);
    await updateAppointment(db, businessId, a.id, { status: "CANCELLED" });
    await notifyCancelled(db, a.id, origin, { byClient: true });

    const all = await messages();
    expect(all.filter((m) => m.kind === "REMINDER").every((m) => m.status === "SKIPPED")).toBe(true);
    expect(all.filter((m) => m.kind === "CANCELLATION")).toHaveLength(2);
    expect(all.filter((m) => m.kind === "CANCELLATION_ALERT")).toHaveLength(1);
  });

  it("rescheduling replaces the reminder with one for the new time", async () => {
    const a = await book("STAFF");
    await notifyBooked(db, a.id, origin, now);
    await rescheduleAppointment(db, businessId, a.id, at("15:00"));
    await notifyRescheduled(db, a.id, origin, now);

    const reminders = (await messages()).filter((m) => m.kind === "REMINDER");
    expect(reminders.filter((m) => m.status === "SKIPPED")).toHaveLength(2);
    expect(reminders.filter((m) => m.status === "QUEUED").map((m) => m.sendAt.toISOString())).toEqual([
      "2026-12-06T15:00:00.000Z",
      "2026-12-06T15:00:00.000Z",
    ]);
    expect((await messages()).find((m) => m.kind === "RESCHEDULE")?.body).toContain("moved to Monday 7 December at 15:00");
  });

  it("status changes: completing stops reminders; restoring a cancellation re-confirms; undoing completed sends nothing", async () => {
    const a = await book("STAFF");
    await notifyBooked(db, a.id, origin, now);
    await notifyStatusChange(db, a.id, "BOOKED", "COMPLETED", origin);
    expect((await messages()).filter((m) => m.kind === "REMINDER").every((m) => m.status === "SKIPPED")).toBe(true);

    const before = await db.message.count();
    await notifyStatusChange(db, a.id, "COMPLETED", "BOOKED", origin);
    expect(await db.message.count()).toBe(before);

    await notifyStatusChange(db, a.id, "CANCELLED", "BOOKED", origin);
    expect(await db.message.count({ where: { kind: "CONFIRMATION" } })).toBe(4);
  });
});

describe("plans", () => {
  it("free salons send email only; SMS is a PRO feature", async () => {
    await db.business.update({ where: { id: businessId }, data: { proUntil: null } });
    const a = await book("ONLINE");
    await notifyBooked(db, a.id, origin, now);
    const channels = new Set((await messages()).filter((m) => m.kind !== "NEW_BOOKING_ALERT").map((m) => m.channel));
    expect([...channels]).toEqual(["EMAIL"]);
  });
});

describe("delivery", () => {
  it("sends only due messages, once, and never a reminder for a cancelled appointment", async () => {
    const a = await book("STAFF");
    await notifyBooked(db, a.id, origin, now);

    // Confirmations are due now; reminders are due on 6 Dec.
    expect(await deliverDue(db, now)).toEqual({ sent: 2, failed: 0 });
    expect(await deliverDue(db, now)).toEqual({ sent: 0, failed: 0 });

    await db.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED" } }); // without notify: safety net
    expect(await deliverDue(db, new Date("2026-12-06T10:00:00Z"))).toEqual({ sent: 0, failed: 0 });
    const statuses = (await messages()).map((m) => `${m.kind}:${m.status}`);
    expect(statuses.filter((s) => s.startsWith("CONFIRMATION"))).toEqual(["CONFIRMATION:SENT", "CONFIRMATION:SENT"]);
    expect(statuses.filter((s) => s.startsWith("REMINDER"))).toEqual(["REMINDER:SKIPPED", "REMINDER:SKIPPED"]);
  });
});
