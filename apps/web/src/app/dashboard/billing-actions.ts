"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, appOrigin } from "@/lib/session";
import { stripe, stripeConfigured } from "@/lib/stripe";

// Sends the owner to Stripe: Checkout to start PRO, the Customer Portal to manage or cancel it.

async function owner() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function startCheckout() {
  const user = await owner();
  if (!stripeConfigured()) redirect("/dashboard/billing?error=not-configured");
  const origin = await appOrigin();
  const business = user.business;
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    client_reference_id: business.id,
    ...(business.stripeCustomerId ? { customer: business.stripeCustomerId } : { customer_email: user.email }),
    subscription_data: { metadata: { businessId: business.id } },
    allow_promotion_codes: true,
    locale: "auto",
    success_url: `${origin}/dashboard/billing?upgraded=1`,
    cancel_url: `${origin}/dashboard/billing`,
  });
  redirect(session.url!);
}

export async function openBillingPortal() {
  const user = await owner();
  const business = await prisma.business.findUniqueOrThrow({ where: { id: user.businessId } });
  if (!stripeConfigured() || !business.stripeCustomerId) redirect("/dashboard/billing");
  const session = await stripe().billingPortal.sessions.create({
    customer: business.stripeCustomerId,
    return_url: `${await appOrigin()}/dashboard/billing`,
  });
  redirect(session.url);
}
