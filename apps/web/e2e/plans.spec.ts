import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import Stripe from "stripe";
import { E2E_DATABASE_URL, e2eEnv } from "./env.mjs";
import { monthBounds } from "../src/lib/plans";
import { DEMO, login, reseed } from "./helpers";

// Free plan limit (20 bookings/month), billing page, Stripe webhook → PRO, sign-up trial.
test.describe.configure({ mode: "serial" });
const db = new PrismaClient({ datasourceUrl: E2E_DATABASE_URL });
const demoBusiness = () => db.business.findUniqueOrThrow({ where: { slug: DEMO.slug } });
test.beforeAll(() => reseed());
test.afterAll(() => db.$disconnect());

/** Tops the demo salon up to `total` bookings made this month (in the past, so they don't block any slots). */
async function fillTo(total: number) {
  const b = await demoBusiness();
  const { from, to } = monthBounds(b.timezone); // same rule as the app
  const used = await db.appointment.count({ where: { businessId: b.id, status: { not: "CANCELLED" }, createdAt: { gte: from, lt: to } } });
  const [service, client] = await Promise.all([db.service.findFirstOrThrow({ where: { businessId: b.id } }), db.client.findFirstOrThrow({ where: { businessId: b.id } })]);
  await db.appointment.createMany({
    data: Array.from({ length: Math.max(0, total - used) }, (_, i) => {
      const startsAt = new Date(Date.UTC(2020, 0, 1 + i, 9));
      return { businessId: b.id, serviceId: service.id, clientId: client.id, startsAt, endsAt: new Date(startsAt.getTime() + 3600_000), status: "COMPLETED" };
    }),
  });
}

test("free salon: billing page shows the plan, usage and the PRO offer", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("link", { name: /^Free · \d+\/20$/ })).toBeVisible();
  await page.goto("/dashboard/billing");
  await expect(page.getByText("Free", { exact: true })).toBeVisible();
  await expect(page.getByText(/^\d+ of 20$/)).toBeVisible();
  await expect(page.getByText("150 RON")).toBeVisible();
  await expect(page.getByText("/ month, VAT included")).toBeVisible();
  await expect(page.getByRole("button", { name: "Upgrade to PRO" })).toBeDisabled(); // no Stripe price configured in tests
  await expect(page.getByText("Payments aren't set up on this site yet.")).toBeVisible();
});

test("at 15 the owner is warned; at 20 online booking pauses politely and the owner is alerted once", async ({ page, request }) => {
  await fillTo(16);
  await login(page);
  await expect(page.getByText("4 free bookings left this month.")).toBeVisible();

  await fillTo(20);
  await page.goto(`/book/${DEMO.slug}`);
  await expect(page.getByText(/Online booking is paused for this month\. Please call \+44 20 7946 0000 to book\./)).toBeVisible();
  await expect(page.getByRole("button", { name: /Haircut/ })).toBeDisabled();
  await expect(page.getByText("Booking by")).toBeVisible(); // free plan branding

  // The API refuses too, and the owner gets one alert (not one per attempt).
  const services = (await (await request.get(`/api/public/${DEMO.slug}`)).json()).services;
  const attempt = () =>
    request.post(`/api/public/${DEMO.slug}/bookings`, {
      data: { serviceId: services[0].id, startsAt: new Date(Date.now() + 3 * 864e5).toISOString(), name: "Late", email: "late@example.com" },
    });
  expect((await attempt()).status()).toBe(402);
  expect((await attempt()).status()).toBe(402);
  await expect.poll(() => db.message.count({ where: { kind: "LIMIT_ALERT" } })).toBe(1);

  await page.goto("/dashboard/calendar");
  await expect(page.getByText("You've used all your free bookings this month, so online booking is paused.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Free · 20/20" })).toBeVisible();
});

test("staff get a few extra bookings past the limit, then a clear message", async ({ page }) => {
  await fillTo(23);
  await login(page);
  await page.goto("/dashboard/appointments/new?time=20:00");
  await page.getByLabel("Client").selectOption("new");
  await page.getByLabel("Name").fill("One More");
  await page.getByRole("button", { name: "Book appointment" }).click();
  await expect(page.locator("form [role=alert]")).toContainText("Upgrade to PRO for unlimited bookings");
});

test("a signed Stripe webhook makes the salon PRO: unlimited, no branding", async ({ page, request }) => {
  const b = await demoBusiness();
  const payload = JSON.stringify({
    id: "evt_test",
    object: "event",
    type: "customer.subscription.created",
    data: { object: { id: "sub_e2e", object: "subscription", customer: "cus_e2e", status: "active", metadata: { businessId: b.id }, items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } } },
  });
  const forged = await request.post("/api/stripe/webhook", { data: payload, headers: { "stripe-signature": "t=1,v1=bad", "content-type": "application/json" } });
  expect(forged.status()).toBe(400);

  const signature = new Stripe(e2eEnv.STRIPE_SECRET_KEY).webhooks.generateTestHeaderString({ payload, secret: e2eEnv.STRIPE_WEBHOOK_SECRET });
  const ok = await request.post("/api/stripe/webhook", { data: payload, headers: { "stripe-signature": signature, "content-type": "application/json" } });
  expect(ok.status()).toBe(200);

  await login(page);
  await expect(page.getByRole("link", { name: "PRO", exact: true })).toBeVisible();
  await expect(page.getByText("online booking is paused")).toHaveCount(0);
  await page.goto("/dashboard/billing");
  await expect(page.getByText(/^Renews on /)).toBeVisible();
  await page.goto(`/book/${DEMO.slug}`);
  await expect(page.getByRole("button", { name: /Haircut/ })).toBeEnabled();
  await expect(page.getByText("Booking by")).toHaveCount(0);
});

test("new salons start with a 14-day PRO trial", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Tia Trial");
  await page.getByLabel("Salon name").fill("Trial Studio");
  await page.getByLabel("Email").fill("tia@example.com");
  await page.getByLabel("Password").fill("trial-pass-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("You're on a free 14-day PRO trial.")).toBeVisible();
  await expect(page.getByRole("link", { name: "PRO", exact: true })).toBeVisible();
  await page.goto("/dashboard/billing");
  await expect(page.getByText(/^PRO until .+, then Free unless you upgrade\.$/)).toBeVisible();
});
