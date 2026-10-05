import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bookAppointment, BookingError, getSlots, updateAppointment } from "./booking";

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
