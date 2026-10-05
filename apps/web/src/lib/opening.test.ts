import { describe, expect, it } from "vitest";
import { describeDay, openNow } from "./opening";

const hours = [
  { weekday: 1, startTime: "09:00", endTime: "13:00" },
  { weekday: 1, startTime: "14:00", endTime: "18:00" },
];

describe("opening hours", () => {
  it("knows when the salon is open, in its own timezone", () => {
    // Monday 7 Dec 2026, London = UTC
    expect(openNow(hours, "Europe/London", new Date("2026-12-07T10:00:00Z"))).toEqual({ open: true, until: "13:00", today: 1 });
    expect(openNow(hours, "Europe/London", new Date("2026-12-07T13:30:00Z")).open).toBe(false); // lunch break
    expect(openNow(hours, "Europe/London", new Date("2026-12-07T18:00:00Z")).open).toBe(false); // closing time
    // 08:30 UTC is 09:30 in Paris
    expect(openNow(hours, "Europe/Paris", new Date("2026-12-07T08:30:00Z")).open).toBe(true);
  });

  it("describes a day", () => {
    expect(describeDay(hours, 1)).toBe("09:00–13:00, 14:00–18:00");
    expect(describeDay(hours, 0)).toBe("Closed");
  });
});
