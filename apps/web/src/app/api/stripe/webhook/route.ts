import { prisma } from "@/lib/db";
import { handleStripeEvent, stripe } from "@/lib/stripe";

/**
 * Stripe calls this when subscriptions start, renew, fail or end.
 * In the Stripe dashboard: Developers → Webhooks → add https://<your-site>/api/stripe/webhook
 * with events checkout.session.completed and customer.subscription.created/updated/deleted.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return Response.json({ error: "Stripe is not configured" }, { status: 503 });

  const body = await req.text(); // the signature covers the raw body
  let event;
  try {
    event = await stripe().webhooks.constructEventAsync(body, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
  await handleStripeEvent(prisma, event);
  return Response.json({ received: true });
}
