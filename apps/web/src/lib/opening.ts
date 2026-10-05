import { minutesOfDay, toZonedHHMM, toZonedIsoDate, weekdayOf } from "./time";

export interface HoursWindow {
  weekday: number;
  startTime: string;
  endTime: string;
}

export const WEEKDAYS_MONDAY_FIRST: [number, string][] = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [0, "Sunday"],
];

/** Whether the salon is open right now (in its timezone), and today's weekday. */
export function openNow(hours: HoursWindow[], timezone: string, now = new Date()) {
  const today = weekdayOf(toZonedIsoDate(now, timezone));
  const minute = minutesOfDay(toZonedHHMM(now, timezone));
  const current = hours.find((h) => h.weekday === today && minutesOfDay(h.startTime) <= minute && minute < minutesOfDay(h.endTime));
  return { open: !!current, until: current?.endTime ?? null, today };
}

/** "09:00–13:00, 14:00–18:00" or "Closed". */
export function describeDay(hours: HoursWindow[], weekday: number): string {
  const windows = hours.filter((h) => h.weekday === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime));
  return windows.length ? windows.map((w) => `${w.startTime}–${w.endTime}`).join(", ") : "Closed";
}
