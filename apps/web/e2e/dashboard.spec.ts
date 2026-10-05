import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, login, nextWeekday, pick, reseed } from "./helpers";

// Staff dashboard: calendar, appointments, clients, services, settings.
test.describe.configure({ mode: "serial" });
const day = nextWeekday();
const AUTH = "e2e/.auth/demo.json";

test.beforeAll(async ({ browser }) => {
  reseed();
  // Fresh context without storage state: the file is what this step writes.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await login(page);
  await context.storageState({ path: AUTH });
  await context.close();
});
test.use({ storageState: AUTH });

test("calendar shows bookings in day and week views", async ({ page }) => {
  await page.goto(`/dashboard/calendar?date=${day}`);
  await expect(page.getByRole("link", { name: /Ana Pop/ })).toBeVisible();
  await page.getByRole("link", { name: "week" }).click();
  await expect(page).toHaveURL(/view=week/);
  await expect(page.getByRole("link", { name: /Ben Ionescu/ })).toBeVisible();
});

test("book with a suggested slot and a new client; clashes are refused", async ({ page }) => {
  await page.goto(`/dashboard/appointments/new?date=${day}`);
  await pick(page, "Service", /Gel manicure/);
  await page.getByRole("button", { name: "09:00", exact: true }).click();
  await page.getByLabel("Client").selectOption("new");
  await page.getByLabel("Name").fill("Walkthrough Client");
  await page.getByLabel("Phone").fill("+44 7700 900999");
  await page.getByRole("button", { name: "Book appointment" }).click();
  await expect(page).toHaveURL(/\/dashboard\/calendar\?date=/);
  await expect(page.getByRole("link", { name: /Walkthrough Client/ })).toBeVisible();

  await page.goto(`/dashboard/appointments/new?date=${day}&time=10:15`);
  await pick(page, "Client", /Cara Smith/);
  await page.getByRole("button", { name: "Book appointment" }).click();
  await expect(page.locator("form [role=alert]")).toContainText("overlaps");
});

test("reschedule (clash refused), then complete", async ({ page }) => {
  await page.goto(`/dashboard/calendar?date=${day}`);
  await page.getByRole("link", { name: /Walkthrough Client/ }).click();
  await page.getByLabel("New time").fill("10:00");
  await page.getByRole("button", { name: "Move appointment" }).click();
  await expect(page.getByText("overlaps another appointment")).toBeVisible();
  await page.getByLabel("New time").fill("11:30");
  await page.getByRole("button", { name: "Move appointment" }).click();
  await expect(page.getByText("Appointment moved")).toBeVisible();
  await page.getByRole("button", { name: "Mark completed" }).click();
  await expect(page.getByRole("button", { name: "Undo completed" })).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
});

test("clients: add, search, history", async ({ page }) => {
  await page.goto("/dashboard/clients");
  const add = page.locator("section", { hasText: "Add client" });
  await add.getByLabel("Name").fill("Dana New");
  await add.getByLabel("Email").fill("dana@example.com");
  await add.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByText("Client added")).toBeVisible();
  await expect(page.getByRole("link", { name: /Dana New/ })).toBeVisible();

  await page.getByLabel("Search clients").fill("WALKTHROUGH"); // case-insensitive
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=WALKTHROUGH/);
  await expect(page.locator("main ul li")).toHaveCount(1);
  await page.getByRole("link", { name: /Walkthrough Client/ }).click();
  await expect(page.getByText(/^1 completed visit/)).toBeVisible();
});

test("services: add, then hide from booking", async ({ page }) => {
  await page.goto("/dashboard/services");
  const add = page.locator("section", { hasText: "Add service" });
  await add.getByLabel("Name").fill("Brow tint");
  await add.getByLabel("Minutes").fill("20");
  await add.getByLabel("Price (RON)").fill("60");
  await add.getByRole("button", { name: "Add service" }).click();
  await expect(page.getByText("Service added")).toBeVisible();
  await page.getByRole("link", { name: /Brow tint/ }).click();
  await page.getByLabel(/Bookable/).uncheck();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.goto("/dashboard/services");
  await expect(page.getByText("(hidden)")).toBeVisible();
});

test("settings: opening hours are validated and saved", async ({ page }) => {
  await page.goto("/dashboard/settings");
  await expect(page.getByLabel("Sunday opens")).toHaveCount(0);
  await page.locator("div", { hasText: /^Sunday/ }).getByRole("button", { name: "Open this day" }).click();
  await page.getByLabel("Sunday opens").fill("15:00");
  await page.getByLabel("Sunday closes").fill("11:00");
  await page.getByRole("button", { name: "Save opening hours" }).click();
  await expect(page.getByText("Sunday: 15:00–11:00 ends before it starts")).toBeVisible();
  await page.getByLabel("Sunday opens").fill("10:00");
  await page.getByRole("button", { name: "Save opening hours" }).click();
  await expect(page.getByText("Opening hours saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Sunday opens")).toHaveValue("10:00");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const path of ["calendar?view=week", "calendar", "clients", "services", "settings", "appointments/new", "messages", "reports"]) {
    test(`no sideways scroll: ${path}`, async ({ page }) => {
      await page.goto(`/dashboard/${path}`);
      await expectNoSidewaysScroll(page);
    });
  }
});
