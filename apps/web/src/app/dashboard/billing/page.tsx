import { openBillingPortal, startCheckout } from "@/app/dashboard/billing-actions";
import { buttonClass, Card, PageHeader } from "@/components/ui";
import { dashboardBusiness } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { FREE_MONTHLY_BOOKINGS, PRO_PRICE_RON, STAFF_GRACE_BOOKINGS, usageOf } from "@/lib/plans";
import { stripeConfigured } from "@/lib/stripe";

const PRO_FEATURES = [
  "Unlimited bookings, online and in the calendar",
  "SMS confirmations and reminders for your clients",
  "Your salon page without “Booking by BookMe”",
  "Everything in Free: calendar, clients, salon page, reports",
];

export default async function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  const business = await dashboardBusiness();
  const params = await searchParams;
  const usage = await usageOf(prisma, business);
  const configured = stripeConfigured();
  const percent = Math.min(100, Math.round((usage.used / FREE_MONTHLY_BOOKINGS) * 100));
  const tz = business.timezone;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Plan & billing" />

      {params.upgraded === "1" && (
        <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Thank you! Your PRO plan is being activated. It can take a few seconds; refresh this page if it still says Free.
        </p>
      )}
      {params.error === "not-configured" && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          Payments aren&apos;t set up yet on this site. See DEPLOY.md, step 7 (Stripe).
        </p>
      )}

      <div className="grid gap-6">
        <Card title="Your plan">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-2xl font-semibold">{usage.pro ? "PRO" : "Free"}</p>
              <p className="mt-1 text-sm text-stone-600">
                {usage.pro && usage.source === "subscription" &&
                  (usage.pastDue
                    ? "Your last payment didn't go through. Please update your card to keep PRO."
                    : `Renews ${usage.until ? `on ${formatDateTime(usage.until, tz).split(",").slice(0, 2).join(",")}` : "monthly"}.`)}
                {usage.pro && usage.source === "until" && usage.until && `PRO until ${formatDateTime(usage.until, tz).split(",").slice(0, 2).join(",")}, then Free unless you upgrade.`}
                {!usage.pro && `${FREE_MONTHLY_BOOKINGS} bookings a month, email messages.`}
              </p>
            </div>
            {business.stripeCustomerId && configured && (
              <form action={openBillingPortal}>
                <button className={buttonClass.secondary}>Manage subscription</button>
              </form>
            )}
          </div>

          <div className="mt-5">
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium">Bookings this month</span>
              <span className="tabular-nums text-stone-600">{usage.pro ? `${usage.used} · unlimited` : `${usage.used} of ${FREE_MONTHLY_BOOKINGS}`}</span>
            </div>
            {!usage.pro && (
              <>
                <div className="h-2 overflow-hidden rounded-full bg-stone-200" role="meter" aria-valuemin={0} aria-valuemax={FREE_MONTHLY_BOOKINGS} aria-valuenow={usage.used} aria-label="Bookings used this month">
                  <div className={`h-full rounded-full ${usage.onlinePaused ? "bg-red-600" : usage.warn ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  {usage.onlinePaused
                    ? `Online booking is paused until the 1st. You can still add ${STAFF_GRACE_BOOKINGS} bookings yourself.`
                    : `${usage.remaining} left. Counts new bookings made this month (cancelled ones don't count); resets on the 1st.`}
                </p>
              </>
            )}
          </div>
        </Card>

        {!(usage.pro && usage.source === "subscription") && (
          <Card title="BookMe PRO">
            <p className="text-3xl font-semibold">
              {PRO_PRICE_RON} RON <span className="text-base font-normal text-stone-600">/ month, VAT included</span>
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden className="text-emerald-600">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <form action={startCheckout} className="mt-5">
              <button className={`${buttonClass.primary} px-6 py-2.5`} disabled={!configured}>
                Upgrade to PRO
              </button>
              {!configured && <p className="mt-2 text-xs text-stone-500">Payments aren&apos;t set up on this site yet.</p>}
            </form>
            <p className="mt-3 text-xs text-stone-500">Secure payment by Stripe. Cancel any time; you keep PRO until the end of the paid month.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
