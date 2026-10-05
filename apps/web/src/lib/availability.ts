import { addMinutes, minutesOfDay, zonedTimeToUtc } from "./time";

export interface Interval {
  start: Date;
  end: Date;
}

export interface TimeWindow {
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export interface AvailabilityInput {
  date: string; // "YYYY-MM-DD" in the business timezone
  timezone: string;
  windows: TimeWindow[]; // working hours for that weekday
  busy: Interval[]; // existing appointments (end already includes their buffer)
  durationMinutes: number;
  bufferMinutes: number;
  stepMinutes: number;
  minNoticeMinutes: number;
  now: Date;
}

/** Half-open interval overlap: [a.start, a.end) vs [b.start, b.end). */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Returns the start times of every bookable slot on `date`.
 * A slot must fit the service plus its buffer inside one working window,
 * must not overlap an existing appointment, and must respect the minimum notice.
 */
export function availableSlots(input: AvailabilityInput): Date[] {
  const blockMinutes = input.durationMinutes + input.bufferMinutes;
  const earliest = addMinutes(input.now, input.minNoticeMinutes);
  const slots: Date[] = [];

  for (const window of input.windows) {
    const windowStart = minutesOfDay(window.startTime);
    const windowEnd = minutesOfDay(window.endTime);
    for (let m = windowStart; m + blockMinutes <= windowEnd; m += input.stepMinutes) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const start = zonedTimeToUtc(input.date, `${hh}:${mm}`, input.timezone);
      const candidate = { start, end: addMinutes(start, blockMinutes) };
      if (start < earliest) continue;
      if (input.busy.some((b) => overlaps(candidate, b))) continue;
      slots.push(start);
    }
  }

  // Dedupe: a wall-clock time skipped by a DST change can map onto a neighbouring slot.
  const unique = [...new Map(slots.map((s) => [s.getTime(), s])).values()];
  return unique.sort((a, b) => a.getTime() - b.getTime());
}
