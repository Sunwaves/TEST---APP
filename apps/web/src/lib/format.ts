import { addMinutes, toZonedIsoDate, zonedTimeToUtc } from "./time";

// All prices are in Romanian lei, stored as bani (1/100 RON) in the *Cents fields.
export const CURRENCY = "RON";
const PRICE_LOCALE = "ro-RO";

/** "35,00 RON"; with `whole`, "35 RON" (chart axes). */
export function formatPrice(cents: number, { whole = false }: { whole?: boolean } = {}): string {
  return new Intl.NumberFormat(PRICE_LOCALE, {
    style: "currency",
    currency: CURRENCY,
    ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  }).format(cents / 100);
}

/**
 * Reads a typed price into bani. Accepts Romanian and English styles:
 * "35", "35,5", "35.50", "1.234,50", "1,234.50", "35 RON". Returns null if it isn't a price.
 */
export function parsePrice(input: string): number | null {
  let s = input.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Both used: the later one is the decimal separator, the other groups thousands.
    const decimal = lastComma > lastDot ? "," : ".";
    s = s.replaceAll(decimal === "," ? "." : ",", "").replace(decimal, ".");
  } else if (lastComma >= 0) {
    s = /,\d{3}$/.test(s) && s.split(",").length > 2 ? s.replaceAll(",", "") : s.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replaceAll(".", ""); // "1.234" = one thousand two hundred thirty-four (Romanian grouping)
  }
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
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
