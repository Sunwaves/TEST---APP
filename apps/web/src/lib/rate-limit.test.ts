import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hit, LIMITS, pruneRateLimits } from "./rate-limit";

const db = new PrismaClient();
beforeEach(async () => {
  await db.rateLimit.deleteMany();
});
afterAll(() => db.$disconnect());

describe("rate limiting", () => {
  it("allows up to the limit in a window, then blocks until it resets", async () => {
    const now = new Date("2026-10-05T12:00:00Z");
    const max = LIMITS.signup.max;
    for (let i = 0; i < max; i++) expect((await hit(db, "signup", "1.2.3.4", now)).allowed).toBe(true);
    const blocked = await hit(db, "signup", "1.2.3.4", now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(LIMITS.signup.windowSeconds);

    // Other keys are counted separately.
    expect((await hit(db, "signup", "5.6.7.8", now)).allowed).toBe(true);

    // A new window starts after the reset time.
    const later = new Date(now.getTime() + LIMITS.signup.windowSeconds * 1000);
    expect((await hit(db, "signup", "1.2.3.4", later)).allowed).toBe(true);
  });

  it("counts concurrent attempts exactly", async () => {
    const now = new Date();
    const results = await Promise.all(Array.from({ length: 15 }, () => hit(db, "login", "race", now)));
    expect(results.filter((r) => r.allowed)).toHaveLength(LIMITS.login.max);
  });

  it("prunes expired windows", async () => {
    await hit(db, "booking", "old", new Date("2020-01-01T00:00:00Z"));
    await hit(db, "booking", "fresh");
    await pruneRateLimits(db);
    expect((await db.rateLimit.findMany()).map((r) => r.key)).toEqual(["booking:fresh"]);
  });
});
