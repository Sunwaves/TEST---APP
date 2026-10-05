import { describe, expect, it } from "vitest";
import { layoutLanes } from "./calendar-layout";

const ev = (id: string, start: number, end: number) => ({ id, start, end });
const run = (items: ReturnType<typeof ev>[]) =>
  Object.fromEntries(layoutLanes(items, (e) => e.start, (e) => e.end).map((p) => [p.item.id, [p.lane, p.lanes]]));

describe("layoutLanes", () => {
  it("gives non-overlapping events the full width", () => {
    expect(run([ev("a", 0, 60), ev("b", 60, 120)])).toEqual({ a: [0, 1], b: [0, 1] });
  });

  it("splits overlapping events into columns", () => {
    expect(run([ev("a", 0, 60), ev("b", 30, 90)])).toEqual({ a: [0, 2], b: [1, 2] });
  });

  it("reuses freed columns within a chained group", () => {
    // a overlaps b, b overlaps c, but a and c don't: c can take a's column.
    expect(run([ev("a", 0, 60), ev("b", 30, 120), ev("c", 60, 90)])).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2] });
  });
});
