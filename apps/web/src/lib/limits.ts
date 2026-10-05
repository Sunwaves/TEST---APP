import { headers } from "next/headers";
import { BookingError } from "./booking";
import { prisma } from "./db";
import { hit, type LimitName } from "./rate-limit";

/** The visitor's IP as reported by the host's proxy (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}

/** Counts an attempt against each key; throws a friendly 429 error once a limit is reached. */
export async function enforceLimit(name: LimitName, ...keys: string[]) {
  for (const key of keys) {
    const { allowed, retryAfterSeconds } = await hit(prisma, name, key.toLowerCase());
    if (!allowed) {
      const minutes = Math.ceil(retryAfterSeconds / 60);
      throw new BookingError(`Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, 429);
    }
  }
}
