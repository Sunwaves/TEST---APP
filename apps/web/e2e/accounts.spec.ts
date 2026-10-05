import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { E2E_DATABASE_URL } from "./env.mjs";
import { expectNoSidewaysScroll, login, reseed } from "./helpers";

// Logins, sign-up, separation between salons, password reset.
test.describe.configure({ mode: "serial" });
test.beforeAll(() => reseed());

test("dashboard and staff API require a login", async ({ page, request }) => {
  await page.goto("/dashboard/calendar");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Demo login (development only)")).toHaveCount(0); // hidden in production builds
  expect((await request.get("/api/services")).status()).toBe(401);
  expect((await request.get(`/book/goldie-test-salon`)).status()).toBe(200);
});

test("wrong password is refused and the email is kept", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@goldie.test");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Wrong email or password")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("demo@goldie.test");
});

test("sign up creates a separate salon", async ({ page, browser }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Nora Test");
  await page.getByLabel("Salon name").fill("Nora's Nail Studio");
  await page.getByLabel("Email").fill("nora@example.com");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("at least 8 characters")).toBeVisible();
  await page.getByLabel("Password").fill("nora-pass-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard\/services\?welcome=1/);
  await expect(page.getByText("Welcome to Nora's Nail Studio!")).toBeVisible();

  const add = page.locator("section", { hasText: "Add service" });
  await add.getByLabel("Name").fill("Gel nails");
  await add.getByLabel("Minutes").fill("45");
  await add.getByLabel("Price (RON)").fill("95,50");
  await add.getByRole("button", { name: "Add service" }).click();
  await expect(page.getByText("Service added")).toBeVisible();

  expect(await (await page.request.get("/api/clients")).json()).toEqual([]);
  await page.goto("/dashboard/calendar?view=week");
  await expect(page.getByText("Ana Pop")).toHaveCount(0);
  await page.goto("/book/nora-s-nail-studio");
  await expect(page.getByRole("button", { name: /Gel nails/ })).toBeVisible();
  await expect(page.getByText(/^95,50\sRON$/)).toBeVisible(); // typed with a comma, shown in lei

  // Can't open the demo salon's appointments.
  const demo = await browser.newPage();
  await login(demo);
  const [appt] = await (await demo.request.get("/api/appointments?from=2020-01-01T00:00:00Z&to=2030-01-01T00:00:00Z")).json();
  await page.goto(`/dashboard/appointments/${appt.id}`);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  await page.goto("/dashboard/settings");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard/calendar");
  await expect(page).toHaveURL(/\/login$/);
});

test("password reset works once and signs in with the new password", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("nora@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an account exists")).toBeVisible();

  // Email is simulated: read the link from the message log.
  const db = new PrismaClient({ datasourceUrl: E2E_DATABASE_URL });
  const message = await db.message.findFirstOrThrow({ where: { kind: "PASSWORD_RESET", recipient: "nora@example.com", status: "SENT" } });
  await db.$disconnect();
  const link = message.body.match(/http\S+/)![0];

  await page.goto(link);
  await page.getByLabel(/^New password/).fill("brand-new-1");
  await page.getByLabel("Repeat new password").fill("different-1");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("don't match")).toBeVisible();
  await page.getByLabel("Repeat new password").fill("brand-new-1");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/login\?reset=1/);
  await page.goto(link);
  await expect(page.getByText("Link expired")).toBeVisible();
  await login(page, "nora@example.com", "brand-new-1");
});

test("too many wrong passwords are slowed down", async ({ page }) => {
  await page.goto("/login");
  for (let i = 0; i < 11; i++) {
    await page.getByLabel("Email").fill("limit@example.com");
    await page.getByLabel("Password").fill("nope");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("form [role=alert]")).toBeVisible();
  }
  await expect(page.locator("form [role=alert]")).toContainText("Too many attempts");
});

test("auth pages fit on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/login", "/signup", "/", "/no-such-page"]) {
    await page.goto(path);
    await expectNoSidewaysScroll(page);
  }
});

test("security headers are sent", async ({ request }) => {
  const res = await request.get("/login");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["x-powered-by"]).toBeUndefined();
});
