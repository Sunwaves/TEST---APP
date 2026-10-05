import type { Business, Prisma, PrismaClient } from "@prisma/client";
import { BookingError } from "./errors";
import { addDays } from "./format";
import { toZonedIsoDate, zonedTimeToUtc } from "./time";

// Free vs PRO. PRO = an active Stripe subscription, or a date in proUntil (trial or given by the admin).

export const PRO_PRICE_RON = 150; // per month, VAT included (the Stripe price must match)
export const FREE_MONTHLY_BOOKINGS = 20;
export const STAFF_GRACE_BOOKINGS = 3; // staff may add a few past the limit; online booking pauses at the limit
export const WARN_FROM_BOOKINGS = 15;
export const TRIAL_DAYS = 14;

// past_due keeps PRO while Stripe retries the card; Stripe then cancels and we fall back to Free.
const PRO_STATUSES = new Set(["active", "trialing", "past_due"]);

type PlanFields = Pick<Business, "proUntil" | "subscriptionStatus" | "subscriptionPeriodEnd">;

export function planOf(b: PlanFields, now = new Date()) {
  if (b.subscriptionStatus && PRO_STATUSES.has(b.subscriptionStatus)) {
    return { pro: true, source: "subscription" as const, until: b.subscriptionPeriodEnd, pastDue: b.subscriptionStatus === "past_due" };
  }
  if (b.proUntil && b.proUntil > now) return { pro: true, source: "until" as const, until: b.proUntil, pastDue: false };
  return { pro: false, source: null, until: null, pastDue: false };
}

/** Start and end of the current calendar month in the salon's timezone. */
export function monthBounds(timezone: string, now = new Date()) {
  const first = `${toZonedIsoDate(now, timezone).slice(0, 8)}01`;
  const next = `${addDays(first, 32).slice(0, 8)}01`;
  return { from: zonedTimeToUtc(first, "00:00", timezone), to: zonedTimeToUtc(next, "00:00", timezone) };
}

type Db = PrismaClient | Prisma.TransactionClient;

/** Bookings that count toward the free limit: made this month (by creation date), not cancelled. */
export async function bookingsThisMonth(db: Db, business: Pick<Business, "id" | "timezone">, now = new Date()) {
  const { from, to } = monthBounds(business.timezone, now);
  return db.appointment.count({
    where: { businessId: business.id, createdAt: { gte: from, lt: to }, status: { not: "CANCELLED" } },
  });
}

export async function usageOf(db: Db, business: Business, now = new Date()) {
  const plan = planOf(business, now);
  const used = await bookingsThisMonth(db, business, now);
  return {
    ...plan,
    used,
    limit: FREE_MONTHLY_BOOKINGS,
    remaining: Math.max(0, FREE_MONTHLY_BOOKINGS - used),
    warn: !plan.pro && used >= WARN_FROM_BOOKINGS,
    onlinePaused: !plan.pro && used >= FREE_MONTHLY_BOOKINGS,
  };
}

/** Thrown when a free salon can't take another booking this month. */
export class LimitReachedError extends BookingError {
  constructor(message: string) {
    super(message, 402);
  }
}

/** Called inside the booking transaction, so two last-minute bookings can't both slip through. */
export async function assertCanBook(db: Db, business: Business, source: "STAFF" | "ONLINE", now = new Date()) {
  if (planOf(business, now).pro) return;
  const used = await bookingsThisMonth(db, business, now);
  if (source === "ONLINE" && used >= FREE_MONTHLY_BOOKINGS) {
    throw new LimitReachedError("Online booking is paused for this salon this month. Please contact the salon directly.");
  }
  if (source === "STAFF" && used >= FREE_MONTHLY_BOOKINGS + STAFF_GRACE_BOOKINGS) {
    throw new LimitReachedError(
      `You've used all ${FREE_MONTHLY_BOOKINGS} free bookings this month (plus ${STAFF_GRACE_BOOKINGS} extra). Upgrade to PRO for unlimited bookings.`,
    );
  }
}

export function trialEndsAt(now = new Date()) {
  return new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}
