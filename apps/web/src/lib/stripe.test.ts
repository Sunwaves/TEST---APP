import { PrismaClient } from "@prisma/client";
import type Stripe from "stripe";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { planOf } from "./plans";
import { handleStripeEvent } from "./stripe";

const db = new PrismaClient();
let businessId: string;

beforeEach(async () => {
  await db.business.deleteMany();
  businessId = (await db.business.create({ data: { name: "Glow", slug: "glow" } })).id;
});
afterAll(() => db.$disconnect());

const event = (type: string, object: object) => ({ type, data: { object } }) as unknown as Stripe.Event;
const subscription = (status: string, extra: object = {}) => ({
  id: "sub_123",
  customer: "cus_123",
  status,
  metadata: { businessId },
  items: { data: [{ current_period_end: Date.UTC(2026, 10, 5) / 1000 }] },
  ...extra,
});
const business = () => db.business.findUniqueOrThrow({ where: { id: businessId } });

describe("Stripe webhooks", () => {
  it("checkout links the Stripe customer and subscription to the salon", async () => {
    await handleStripeEvent(db, event("checkout.session.completed", { mode: "subscription", client_reference_id: businessId, customer: "cus_123", subscription: "sub_123" }));
    expect(await business()).toMatchObject({ stripeCustomerId: "cus_123", stripeSubscriptionId: "sub_123" });
  });

  it("subscription events switch the salon between PRO and Free", async () => {
    await handleStripeEvent(db, event("customer.subscription.created", subscription("active")));
    let b = await business();
    expect(planOf(b).pro).toBe(true);
    expect(b.subscriptionPeriodEnd?.toISOString()).toBe("2026-11-05T00:00:00.000Z");

    await handleStripeEvent(db, event("customer.subscription.updated", subscription("past_due")));
    expect(planOf(await business())).toMatchObject({ pro: true, pastDue: true }); // grace while Stripe retries the card

    await handleStripeEvent(db, event("customer.subscription.deleted", subscription("canceled")));
    b = await business();
    expect(b.subscriptionStatus).toBe("canceled");
    expect(planOf(b).pro).toBe(false);
  });

  it("finds the salon by customer when metadata is missing, and ignores unknown salons and events", async () => {
    await db.business.update({ where: { id: businessId }, data: { stripeCustomerId: "cus_123" } });
    await handleStripeEvent(db, event("customer.subscription.updated", subscription("active", { metadata: {} })));
    expect((await business()).subscriptionStatus).toBe("active");

    await handleStripeEvent(db, event("customer.subscription.updated", subscription("active", { metadata: {}, customer: "cus_other" })));
    await handleStripeEvent(db, event("invoice.created", {}));
    expect((await business()).stripeCustomerId).toBe("cus_123");
  });
});
