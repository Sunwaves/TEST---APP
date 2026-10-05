import { describe, expect, it } from "vitest";
import { availableSlots, overlaps, type AvailabilityInput } from "./availability";

const base: AvailabilityInput = {
  date: "2026-12-07", // a Monday in winter, London = UTC
  timezone: "Europe/London",
  windows: [{ startTime: "09:00", endTime: "12:00" }],
  busy: [],
  durationMinutes: 60,
  bufferMinutes: 0,
  stepMinutes: 30,
  minNoticeMinutes: 0,
  now: new Date("2026-12-01T00:00:00Z"),
};

const hhmm = (dates: Date[]) => dates.map((d) => d.toISOString().slice(11, 16));

describe("overlaps", () => {
  it("treats touching intervals as free", () => {
    const a = { start: new Date("2026-01-01T09:00Z"), end: new Date("2026-01-01T10:00Z") };
    const b = { start: new Date("2026-01-01T10:00Z"), end: new Date("2026-01-01T11:00Z") };
    expect(overlaps(a, b)).toBe(false);
    expect(overlaps(a, { ...b, start: new Date("2026-01-01T09:59Z") })).toBe(true);
  });
});

describe("availableSlots", () => {
  it("lists slots that fit inside working hours", () => {
    expect(hhmm(availableSlots(base))).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });

  it("requires the buffer to fit too", () => {
    expect(hhmm(availableSlots({ ...base, bufferMinutes: 30 }))).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });

  it("skips slots that clash with existing appointments", () => {
    const busy = [{ start: new Date("2026-12-07T10:00Z"), end: new Date("2026-12-07T10:30Z") }];
    expect(hhmm(availableSlots({ ...base, busy }))).toEqual(["09:00", "10:30", "11:00"]);
  });

  it("respects minimum notice", () => {
    const now = new Date("2026-12-07T09:10Z");
    expect(hhmm(availableSlots({ ...base, now, minNoticeMinutes: 60 }))).toEqual(["10:30", "11:00"]);
  });

  it("handles split shifts and returns slots in order", () => {
    const windows = [
      { startTime: "14:00", endTime: "15:00" },
      { startTime: "09:00", endTime: "10:00" },
    ];
    expect(hhmm(availableSlots({ ...base, windows }))).toEqual(["09:00", "14:00"]);
  });

  it("returns nothing on a day off", () => {
    expect(availableSlots({ ...base, windows: [] })).toEqual([]);
  });

  it("uses the business timezone", () => {
    // Summer: 09:00 London is 08:00 UTC.
    const slots = availableSlots({ ...base, now: new Date("2026-06-01T00:00Z"), date: "2026-07-06", windows: [{ startTime: "09:00", endTime: "10:00" }] });
    expect(slots.map((d) => d.toISOString())).toEqual(["2026-07-06T08:00:00.000Z"]);
  });
});
