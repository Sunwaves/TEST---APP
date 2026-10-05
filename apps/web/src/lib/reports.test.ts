import { describe, expect, it } from "vitest";
import { buildReport, type ReportAppointment } from "./reports";

const cut = { id: "cut", name: "Cut", priceCents: 3000 };
const colour = { id: "colour", name: "Colour", priceCents: 9000 };
const appt = (day: string, status: string, service = cut, clientId = "ana", source = "STAFF"): ReportAppointment => ({
  startsAt: new Date(`${day}T10:00:00Z`),
  status,
  source,
  clientId,
  client: { name: clientId === "ana" ? "Ana" : "Ben" },
  service,
});

describe("buildReport", () => {
  const list = [
    appt("2026-12-01", "COMPLETED"),
    appt("2026-12-01", "COMPLETED", colour, "ben", "ONLINE"),
    appt("2026-12-02", "NO_SHOW", cut, "ben"),
    appt("2026-12-03", "CANCELLED", colour, "ana", "ONLINE"),
    appt("2026-12-05", "BOOKED", colour),
  ];
  const firstVisits = new Map([
    ["ana", new Date("2026-06-01T10:00:00Z")], // returning
    ["ben", new Date("2026-12-01T10:00:00Z")], // new this range
  ]);
  const r = buildReport(list, firstVisits, "2026-12-01", "2026-12-07", "Europe/London");

  it("counts revenue from completed only and expected from booked", () => {
    expect(r.revenueCents).toBe(12000);
    expect(r.expectedCents).toBe(9000);
    expect(r.byStatus).toEqual({ BOOKED: 1, COMPLETED: 2, CANCELLED: 1, NO_SHOW: 1 });
    expect([r.online, r.staff]).toEqual([2, 3]);
    expect(r.noShowRate).toBeCloseTo(1 / 3);
  });

  it("buckets revenue by day for short ranges, including empty days", () => {
    expect(r.bucketSize).toBe("day");
    expect(r.buckets).toHaveLength(7);
    expect(r.buckets[0]).toMatchObject({ key: "2026-12-01", revenueCents: 12000, completed: 2, label: "1 Dec" });
    expect(r.buckets[1].revenueCents).toBe(0);
  });

  it("ranks services and clients by money", () => {
    expect(r.topServices.map((s) => [s.name, s.count, s.revenueCents])).toEqual([["Colour", 1, 9000], ["Cut", 1, 3000]]);
    expect(r.topClients.map((c) => c.name)).toEqual(["Ben", "Ana"]);
  });

  it("splits new and returning clients", () => {
    expect([r.newClients, r.returningClients]).toEqual([1, 1]);
  });

  it("uses weekly buckets for long ranges and handles an empty range", () => {
    const empty = buildReport([], new Map(), "2026-09-01", "2026-11-30", "Europe/London");
    expect(empty.bucketSize).toBe("week");
    expect(empty.buckets[0].key).toBe("2026-08-31"); // Monday of the first week
    expect(empty.noShowRate).toBeNull();
    expect(empty.revenueCents).toBe(0);
  });
});
