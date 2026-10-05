import type { PrismaClient } from "@prisma/client";
import Stripe from "stripe";

// Stripe Billing for the PRO plan. Needs STRIPE_SECRET_KEY and STRIPE_PRICE_ID
// (a monthly 150 RON price, tax-inclusive) and, for the webhook, STRIPE_WEBHOOK_SECRET.

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

let client: Stripe | undefined;
export function stripe(): Stripe {
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

/** Copies a subscription's state onto the salon it belongs to (found via metadata, else the customer id). */
export async function applySubscription(db: PrismaClient, sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const businessId = sub.metadata?.businessId;
  const business = businessId
    ? await db.business.findUnique({ where: { id: businessId } })
    : await db.business.findUnique({ where: { stripeCustomerId: customerId } });
  if (!business) return null;

  // In current Stripe API versions the billing period lives on the subscription item.
  const periodEnd = sub.items?.data?.[0]?.current_period_end;
  return db.business.update({
    where: { id: business.id },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      subscriptionPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
  });
}

/** Handles the webhook events that change a salon's plan. Unknown events are ignored. */
export async function handleStripeEvent(db: PrismaClient, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription" || !session.client_reference_id) return;
      const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscription = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      await db.business.updateMany({
        where: { id: session.client_reference_id },
        data: { stripeCustomerId: customer ?? undefined, stripeSubscriptionId: subscription ?? undefined },
      });
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applySubscription(db, event.data.object);
      return;
  }
}
