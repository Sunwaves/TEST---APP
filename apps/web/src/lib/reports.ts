import { addDays, formatDayLabel, startOfWeek } from "./format";
import { toZonedIsoDate } from "./time";

// Business report for a date range, computed from appointments in that range.
// Revenue counts completed appointments only; booked ones count as "expected".

export interface ReportAppointment {
  startsAt: Date;
  status: string;
  source: string;
  clientId: string;
  client: { name: string };
  service: { id: string; name: string; priceCents: number };
}

export interface Bucket {
  key: string; // first day of the bucket, YYYY-MM-DD
  label: string;
  revenueCents: number;
  completed: number;
}

export interface Report {
  revenueCents: number;
  expectedCents: number;
  byStatus: Record<"BOOKED" | "COMPLETED" | "CANCELLED" | "NO_SHOW", number>;
  online: number;
  staff: number;
  noShowRate: number | null; // no-shows / (completed + no-shows)
  bucketSize: "day" | "week";
  buckets: Bucket[];
  topServices: { id: string; name: string; count: number; revenueCents: number }[];
  topClients: { id: string; name: string; visits: number; spentCents: number }[];
  newClients: number;
  returningClients: number;
}

/**
 * @param from first day (inclusive), @param to last day (inclusive), both YYYY-MM-DD in `timezone`
 * @param firstVisits each client's first-ever non-cancelled appointment start
 */
export function buildReport(
  appointments: ReportAppointment[],
  firstVisits: Map<string, Date>,
  from: string,
  to: string,
  timezone: string,
): Report {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const bucketSize = days <= 31 ? "day" : "week";
  const bucketKey = (date: string) => (bucketSize === "day" ? date : startOfWeek(date));

  const buckets = new Map<string, Bucket>();
  for (let d = bucketKey(from); d <= to; d = addDays(d, bucketSize === "day" ? 1 : 7)) {
    buckets.set(d, {
      key: d,
      label: bucketSize === "day" ? formatDayLabel(d, { day: "numeric", month: "short" }) : `w/c ${formatDayLabel(d, { day: "numeric", month: "short" })}`,
      revenueCents: 0,
      completed: 0,
    });
  }

  const byStatus = { BOOKED: 0, COMPLETED: 0, CANCELLED: 0, NO_SHOW: 0 };
  const services = new Map<string, Report["topServices"][number]>();
  const clients = new Map<string, Report["topClients"][number]>();
  let revenueCents = 0;
  let expectedCents = 0;
  let online = 0;

  for (const a of appointments) {
    if (a.status in byStatus) byStatus[a.status as keyof typeof byStatus]++;
    if (a.source === "ONLINE") online++;
    const price = a.service.priceCents;

    if (a.status === "BOOKED") expectedCents += price;
    if (a.status !== "COMPLETED") continue;

    revenueCents += price;
    const bucket = buckets.get(bucketKey(toZonedIsoDate(a.startsAt, timezone)));
    if (bucket) {
      bucket.revenueCents += price;
      bucket.completed++;
    }
    const s = services.get(a.service.id) ?? { id: a.service.id, name: a.service.name, count: 0, revenueCents: 0 };
    s.count++;
    s.revenueCents += price;
    services.set(s.id, s);
    const c = clients.get(a.clientId) ?? { id: a.clientId, name: a.client.name, visits: 0, spentCents: 0 };
    c.visits++;
    c.spentCents += price;
    clients.set(c.id, c);
  }

  // New = their first-ever visit falls in this range; returning = visited before it.
  const rangeStart = from;
  const seen = new Set(appointments.filter((a) => a.status === "BOOKED" || a.status === "COMPLETED").map((a) => a.clientId));
  let newClients = 0;
  for (const id of seen) {
    const first = firstVisits.get(id);
    if (first && toZonedIsoDate(first, timezone) >= rangeStart) newClients++;
  }

  const attended = byStatus.COMPLETED + byStatus.NO_SHOW;
  const byValue = <T extends { revenueCents?: number; spentCents?: number }>(a: T, b: T) =>
    (b.revenueCents ?? b.spentCents ?? 0) - (a.revenueCents ?? a.spentCents ?? 0);

  return {
    revenueCents,
    expectedCents,
    byStatus,
    online,
    staff: appointments.length - online,
    noShowRate: attended ? byStatus.NO_SHOW / attended : null,
    bucketSize,
    buckets: [...buckets.values()],
    topServices: [...services.values()].sort((a, b) => byValue(a, b) || b.count - a.count).slice(0, 5),
    topClients: [...clients.values()].sort((a, b) => byValue(a, b) || b.visits - a.visits).slice(0, 5),
    newClients,
    returningClients: seen.size - newClients,
  };
}
