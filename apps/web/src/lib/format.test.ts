import { describe, expect, it } from "vitest";
import { formatPrice, parsePrice } from "./format";

const plain = (s: string) => s.replace(/\s/g, " "); // Intl uses a non-breaking space

describe("prices in RON", () => {
  it("formats Romanian style", () => {
    expect(plain(formatPrice(3500))).toBe("35,00 RON");
    expect(plain(formatPrice(123450))).toBe("1.234,50 RON");
    expect(plain(formatPrice(20000, { whole: true }))).toBe("200 RON");
  });

  it("reads prices typed the Romanian or English way", () => {
    expect(parsePrice("35")).toBe(3500);
    expect(parsePrice("35,5")).toBe(3550);
    expect(parsePrice("35,50")).toBe(3550);
    expect(parsePrice("35.50")).toBe(3550);
    expect(parsePrice("1.234,50")).toBe(123450);
    expect(parsePrice("1,234.50")).toBe(123450);
    expect(parsePrice("1.234")).toBe(123400); // Romanian thousands grouping
    expect(parsePrice("120 RON")).toBe(12000);
    expect(parsePrice(" 99,9 lei ")).toBe(9990);
  });

  it("rejects things that aren't prices", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("free")).toBeNull();
    expect(parsePrice("12,345")).toBeNull(); // three decimals: ambiguous, ask again
    expect(parsePrice("1.2.3")).toBeNull();
  });
});
