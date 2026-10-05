import { describe, expect, it } from "vitest";
import { isHHMM, isIsoDate, toZonedHHMM, toZonedIsoDate, weekdayOf, zonedTimeToUtc } from "./time";

describe("time helpers", () => {
  it("validates dates and times", () => {
    expect(isIsoDate("2026-10-05")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-1-5")).toBe(false);
    expect(isHHMM("09:30")).toBe(true);
    expect(isHHMM("24:00")).toBe(false);
  });

  it("computes weekdays", () => {
    expect(weekdayOf("2026-10-05")).toBe(1); // Monday
    expect(weekdayOf("2026-10-04")).toBe(0); // Sunday
  });

  it("converts wall-clock time to UTC across DST", () => {
    // London is UTC+1 in summer, UTC+0 in winter.
    expect(zonedTimeToUtc("2026-07-01", "09:00", "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedTimeToUtc("2026-12-01", "09:00", "Europe/London").toISOString()).toBe("2026-12-01T09:00:00.000Z");
    expect(zonedTimeToUtc("2026-07-01", "09:00", "America/New_York").toISOString()).toBe("2026-07-01T13:00:00.000Z");
  });

  it("formats instants in a timezone", () => {
    const instant = new Date("2026-07-01T23:30:00Z");
    expect(toZonedIsoDate(instant, "Europe/London")).toBe("2026-07-02");
    expect(toZonedHHMM(instant, "Europe/London")).toBe("00:30");
  });
});
