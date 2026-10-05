import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bookAppointment } from "./booking";
import { assertCanBook, FREE_MONTHLY_BOOKINGS, LimitReachedError, monthBounds, planOf, STAFF_GRACE_BOOKINGS, usageOf } from "./plans";

const db = new PrismaClient();
const now = new Date("2026-12-10T12:00:00Z");
let businessId: string;
let serviceId: string;
let clientId: string;

beforeEach(async () => {
  await db.business.deleteMany();
  const b = await db.business.create({
    data: { name: "Glow", slug: "glow", minNoticeMinutes: 0, workingHours: { create: [{ weekday: 1, startTime: "09:00", endTime: "17:00" }] } },
  });
  businessId = b.id;
  serviceId = (await db.service.create({ data: { businessId, name: "Cut", durationMinutes: 30, priceCents: 12000 } })).id;
  clientId = (await db.client.create({ data: { businessId, name: "Ana" } })).id;
});
afterAll(() => db.$disconnect());

/** Adds `n` appointments created at `createdAt` (spread over different past days so they never clash). */
async function addBookings(n: number, createdAt = now, status = "COMPLETED") {
  await db.appointment.createMany({
    data: Array.from({ length: n }, (_, i) => {
      const startsAt = new Date(Date.UTC(2026, 10, 1 + i, 9));
      return { businessId, serviceId, clientId, startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60_000), status, createdAt };
    }),
  });
}
const business = () => db.business.findUniqueOrThrow({ where: { id: businessId } });
const monday = (hhmm: string) => new Date(`2026-12-14T${hhmm}:00Z`);

describe("planOf", () => {
  it("is PRO with an active (or retrying) subscription, or until a given date", () => {
    const none = { proUntil: null, subscriptionStatus: null, subscriptionPeriodEnd: null };
    expect(planOf(none, now).pro).toBe(false);
    expect(planOf({ ...none, subscriptionStatus: "active" }, now).pro).toBe(true);
    expect(planOf({ ...none, subscriptionStatus: "past_due" }, now)).toMatchObject({ pro: true, pastDue: true });
    expect(planOf({ ...none, subscriptionStatus: "canceled" }, now).pro).toBe(false);
    expect(planOf({ ...none, proUntil: new Date("2026-12-20") }, now)).toMatchObject({ pro: true, source: "until" });
    expect(planOf({ ...none, proUntil: new Date("2026-12-01") }, now).pro).toBe(false); // trial over
  });
});

describe("monthBounds", () => {
  it("uses the salon's timezone", () => {
    const { from, to } = monthBounds("Europe/Bucharest", new Date("2026-10-15T12:00:00Z"));
    expect(from.toISOString()).toBe("2026-09-30T21:00:00.000Z"); // 1 Oct 00:00 in Bucharest (UTC+3)
    expect(to.toISOString()).toBe("2026-10-31T22:00:00.000Z"); // 1 Nov 00:00 (UTC+2 after the clock change)
  });
});

describe("free plan limit", () => {
  it("counts this month's non-cancelled bookings only", async () => {
    await addBookings(5);
    await addBookings(4, now, "CANCELLED");
    await addBookings(7, new Date("2026-11-20T12:00:00Z")); // last month
    const usage = await usageOf(db, await business(), now);
    expect(usage).toMatchObject({ pro: false, used: 5, remaining: FREE_MONTHLY_BOOKINGS - 5, warn: false, onlinePaused: false });
  });

  it("warns from 15, pauses online booking at 20, and gives staff a few extra", async () => {
    await addBookings(15);
    expect((await usageOf(db, await business(), now)).warn).toBe(true);

    await addBookings(FREE_MONTHLY_BOOKINGS - 15);
    expect((await usageOf(db, await business(), now)).onlinePaused).toBe(true);
    await expect(assertCanBook(db, await business(), "ONLINE", now)).rejects.toBeInstanceOf(LimitReachedError);
    await expect(assertCanBook(db, await business(), "STAFF", now)).resolves.toBeUndefined();

    await addBookings(STAFF_GRACE_BOOKINGS);
    await expect(assertCanBook(db, await business(), "STAFF", now)).rejects.toBeInstanceOf(LimitReachedError);
  });

  it("is enforced when booking, and PRO is unlimited", async () => {
    await addBookings(FREE_MONTHLY_BOOKINGS);
    const online = { serviceId, startsAt: monday("09:00"), source: "ONLINE" as const, client: { name: "New", email: "n@example.com" } };
    await expect(bookAppointment(db, businessId, online, now)).rejects.toMatchObject({ status: 402 });

    await db.business.update({ where: { id: businessId }, data: { subscriptionStatus: "active" } });
    await expect(bookAppointment(db, businessId, online, now)).resolves.toMatchObject({ source: "ONLINE" });
  });
});
