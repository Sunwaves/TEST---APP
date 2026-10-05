import { describe, expect, it } from "vitest";
import { buildIcs } from "./ics";

describe("buildIcs", () => {
  const base = {
    uid: "abc@goldie",
    start: new Date("2026-10-06T09:00:00Z"),
    end: new Date("2026-10-06T10:00:00Z"),
    summary: "Haircut, Goldie Test Salon",
    now: new Date("2026-10-05T12:00:00Z"),
  };

  it("produces a valid event with escaped text and CRLF line endings", () => {
    const ics = buildIcs({ ...base, location: "1 High St; London" });
    expect(ics).toContain("DTSTART:20261006T090000Z\r\n");
    expect(ics).toContain("DTEND:20261006T100000Z\r\n");
    expect(ics).toContain("SUMMARY:Haircut\\, Goldie Test Salon\r\n");
    expect(ics).toContain("LOCATION:1 High St\; London\r\n");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
  });

  it("folds long lines to 75 octets", () => {
    const ics = buildIcs({ ...base, description: "x".repeat(200) });
    const lines = ics.split("\r\n");
    expect(lines.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(lines.some((l) => l.startsWith(" x"))).toBe(true);
  });

  it("marks cancelled events", () => {
    expect(buildIcs({ ...base, cancelled: true })).toContain("STATUS:CANCELLED");
  });
});
