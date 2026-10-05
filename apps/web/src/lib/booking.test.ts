import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  bookAppointment,
  BookingError,
  cancelByToken,
  getSlots,
  rescheduleAppointment,
  setWorkingHours,
  updateAppointment,
  workingHoursProblem,
} from "./booking";

const db = new PrismaClient();
const now = new Date("2026-12-01T00:00:00Z");
const monday = "2026-12-07"; // London = UTC in December
let businessId: string;
let serviceId: string;

beforeEach(async () => {
  await db.business.deleteMany();
  const business = await db.business.create({
    data: {
      name: "Test",
      slug: "test",
      timezone: "Europe/London",
      slotStepMinutes: 30,
      minNoticeMinutes: 0,
      workingHours: { create: [{ weekday: 1, startTime: "09:00", endTime: "11:00" }] },
    },
  });
  businessId = business.id;
  const service = await db.service.create({
    data: { businessId, name: "Cut", durationMinutes: 30, bufferMinutes: 30, priceCents: 2000 },
  });
  serviceId = service.id;
});

afterAll(() => db.$disconnect());

const at = (hhmm: string) => new Date(`${monday}T${hhmm}:00Z`);
const times = (slots: Date[]) => slots.map((s) => s.toISOString().slice(11, 16));

async function rejects(promise: Promise<unknown>, status: number) {
  const err: unknown = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(BookingError);
  expect((err as BookingError).status).toBe(status);
}

describe("booking", () => {
  it("offers slots and removes them once booked (including buffer)", async () => {
    expect(times(await getSlots(db, businessId, serviceId, monday, now))).toEqual(["09:00", "09:30", "10:00"]);

    const appt = await bookAppointment(db, businessId, { serviceId, startsAt: at("09:30"), source: "ONLINE", client: { name: "Ana" } }, now);
    expect(appt.endsAt.toISOString()).toBe(at("10:30").toISOString());
    expect(appt.client.name).toBe("Ana");

    // 09:00 would run into 09:30; 10:00 starts inside the buffer.
    expect(times(await getSlots(db, businessId, serviceId, monday, now))).toEqual([]);
  });

  it("rejects online bookings off the slot grid", async () => {
    await rejects(bookAppointment(db, businessId, { serviceId, startsAt: at("09:10"), source: "ONLINE", client: { name: "Ana" } }, now), 409);
  });

  it("rejects double-booking from staff", async () => {
    await bookAppointment(db, businessId, { serviceId, startsAt: at("09:00"), source: "STAFF", client: { name: "Ana" } }, now);
    await rejects(bookAppointment(db, businessId, { serviceId, startsAt: at("09:45"), source: "STAFF", client: { name: "Ben" } }, now), 409);
    // Staff can book outside opening hours as long as nothing clashes.
    await bookAppointment(db, businessId, { serviceId, startsAt: at("18:00"), source: "STAFF", client: { name: "Ben" } }, now);
  });

  it("frees the slot when cancelled and blocks reinstating over a new booking", async () => {
    const first = await bookAppointment(db, businessId, { serviceId, startsAt: at("09:00"), source: "STAFF", client: { name: "Ana" } }, now);
    await updateAppointment(db, businessId, first.id, { status: "CANCELLED" });
    expect(times(await getSlots(db, businessId, serviceId, monday, now))).toContain("09:00");

    await bookAppointment(db, businessId, { serviceId, startsAt: at("09:00"), source: "ONLINE", client: { name: "Ben" } }, now);
    await rejects(updateAppointment(db, businessId, first.id, { status: "BOOKED" }), 409);
  });

  it("does not use clients or services from another business", async () => {
    const other = await db.business.create({ data: { name: "Other", slug: "other" } });
    const stranger = await db.client.create({ data: { businessId: other.id, name: "Stranger" } });
    await rejects(bookAppointment(db, businessId, { serviceId, startsAt: at("09:00"), source: "STAFF", clientId: stranger.id }, now), 404);
    await rejects(getSlots(db, other.id, serviceId, monday, now), 404);
  });
});

describe("rescheduling", () => {
  it("moves an appointment, keeping its length, and refuses clashes", async () => {
    const a = await bookAppointment(db, businessId, { serviceId, startsAt: at("09:00"), source: "STAFF", client: { name: "Ana" } }, now);
    await bookAppointment(db, businessId, { serviceId, startsAt: at("10:00"), source: "STAFF", client: { name: "Ben" } }, now);

    // Overlapping its own old time is fine.
    const moved = await rescheduleAppointment(db, businessId, a.id, at("08:30"));
    expect(moved.endsAt.toISOString()).toBe(at("09:30").toISOString());

    await rejects(rescheduleAppointment(db, businessId, a.id, at("09:45")), 409);
  });

  it("only moves booked appointments", async () => {
    const a = await bookAppointment(db, businessId, { serviceId, startsAt: at("09:00"), source: "STAFF", client: { name: "Ana" } }, now);
    await updateAppointment(db, businessId, a.id, { status: "CANCELLED" });
    await rejects(rescheduleAppointment(db, businessId, a.id, at("10:00")), 400);
  });
});

describe("opening hours", () => {
  it("validates windows", () => {
    expect(workingHoursProblem([{ weekday: 1, startTime: "09:00", endTime: "12:00" }, { weekday: 1, startTime: "13:00", endTime: "17:00" }])).toBeNull();
    expect(workingHoursProblem([{ weekday: 2, startTime: "12:00", endTime: "09:00" }])).toMatch(/Tuesday/);
    expect(workingHoursProblem([{ weekday: 1, startTime: "09:00", endTime: "13:00" }, { weekday: 1, startTime: "12:00", endTime: "17:00" }])).toMatch(/overlap/);
  });

  it("replaces the weekly schedule and changes availability", async () => {
    await setWorkingHours(db, businessId, [{ weekday: 1, startTime: "15:00", endTime: "16:00" }]);
    expect(times(await getSlots(db, businessId, serviceId, monday, now))).toEqual(["15:00"]);
    await rejects(setWorkingHours(db, businessId, [{ weekday: 1, startTime: "16:00", endTime: "15:00" }]), 400);
  });
});

describe("online booking", () => {
  it("gives every booking a unique manage token", async () => {
    const a = await bookAppointment(db, businessId, { serviceId, startsAt: at("09:00"), source: "ONLINE", client: { name: "Ana" } }, now);
    const b = await bookAppointment(db, businessId, { serviceId, startsAt: at("10:00"), source: "STAFF", client: { name: "Ben" } }, now);
    expect(a.manageToken).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(a.manageToken).not.toBe(b.manageToken);
  });

  it("matches returning online clients by email, then phone", async () => {
    const existing = await db.client.create({ data: { businessId, name: "Ana Pop", email: "ana@example.com", phone: "07700900001" } });
    const byEmail = await bookAppointment(db, businessId, { serviceId, startsAt: at("09:00"), source: "ONLINE", client: { name: "Ana P", email: "ana@example.com" } }, now);
    const byPhone = await bookAppointment(db, businessId, { serviceId, startsAt: at("10:00"), source: "ONLINE", client: { name: "A", phone: "07700900001" } }, now);
    expect(byEmail.clientId).toBe(existing.id);
    expect(byPhone.clientId).toBe(existing.id);
    expect(await db.client.count({ where: { businessId } })).toBe(1);
  });

  it("refuses online bookings beyond the booking window", async () => {
    await db.business.update({ where: { id: businessId }, data: { maxAdvanceDays: 3 } });
    // `now` is 1 Dec; Monday 7 Dec is 6 days ahead.
    await rejects(bookAppointment(db, businessId, { serviceId, startsAt: at("09:00"), source: "ONLINE", client: { name: "Ana" } }, now), 409);
  });

  it("lets the client cancel by token until the appointment starts", async () => {
    const a = await bookAppointment(db, businessId, { serviceId, startsAt: at("09:00"), source: "ONLINE", client: { name: "Ana" } }, now);
    await rejects(cancelByToken(db, a.manageToken!, new Date(`${monday}T09:00:00Z`)), 400);
    await rejects(cancelByToken(db, "nope", now), 404);
    const cancelled = await cancelByToken(db, a.manageToken!, now);
    expect(cancelled.status).toBe("CANCELLED");
    await rejects(cancelByToken(db, a.manageToken!, now), 400);
  });
});
