import { addMinutes, toZonedIsoDate, zonedTimeToUtc } from "./time";

export function formatPrice(cents: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(cents / 100);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "Mon 5 Oct" style label for a calendar date. */
export function formatDayLabel(isoDate: string, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatDateTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
}

export function todayIn(timeZone: string, now = new Date()): string {
  return toZonedIsoDate(now, timeZone);
}

/** Adds whole days to a calendar date "YYYY-MM-DD". */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Monday of the week containing `isoDate`. */
export function startOfWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(isoDate, -((weekday + 6) % 7));
}

/** UTC bounds of a run of calendar days in `timeZone`. */
export function dayRange(isoDate: string, days: number, timeZone: string) {
  const from = zonedTimeToUtc(isoDate, "00:00", timeZone);
  const to = zonedTimeToUtc(addDays(isoDate, days), "00:00", timeZone);
  return { from, to: to > from ? to : addMinutes(from, days * 24 * 60) };
}

export const STATUS_LABELS: Record<string, string> = {
  BOOKED: "Booked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};
