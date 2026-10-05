import type { PrismaClient } from "@prisma/client";

// Fixed-window rate limiting stored in Postgres, so limits hold across server instances.

export const LIMITS = {
  login: { max: 10, windowSeconds: 15 * 60 }, // per IP + email
  loginIp: { max: 50, windowSeconds: 15 * 60 }, // per IP, any email
  signup: { max: 5, windowSeconds: 60 * 60 },
  passwordReset: { max: 5, windowSeconds: 60 * 60 }, // per IP and per email
  booking: { max: 10, windowSeconds: 60 * 60 }, // online bookings per IP
  cancel: { max: 20, windowSeconds: 60 * 60 },
} as const;

export type LimitName = keyof typeof LIMITS;

/** Counts one attempt. Returns whether it is allowed and, if not, how long until the window resets. */
export async function hit(db: PrismaClient, name: LimitName, key: string, now = new Date()) {
  const { max, windowSeconds } = LIMITS[name];
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);
  // One atomic statement: start a new window if the old one expired, otherwise add one.
  const [row] = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${`${name}:${key}`}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  return {
    allowed: row.count <= max,
    retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000)),
  };
}

export async function pruneRateLimits(db: PrismaClient, now = new Date()) {
  await db.rateLimit.deleteMany({ where: { resetAt: { lte: now } } });
}
