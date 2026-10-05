import { expect, test } from "@playwright/test";
import { DEMO, expectNoSidewaysScroll, login, reseed } from "./helpers";

// The public booking page and the client's manage-booking page.
test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 390, height: 844 } });
test.beforeAll(() => reseed());

let manageUrl = "";
let bookedTime = "";

test("a client books online from a phone", async ({ page }) => {
  await page.goto(`/book/${DEMO.slug}`);
  await expect(page.getByRole("heading", { name: "Goldie Test Salon" })).toBeVisible();
  await expect(page.getByText("12 Example Street")).toBeVisible();
  await page.getByRole("button", { name: /Gel manicure/ }).click();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Sunday/ }).first()).toBeDisabled();

  await page.locator("div.grid-cols-7 button:not([disabled])").nth(1).click();
  const slot = page.locator("div.grid-cols-3 button").first();
  bookedTime = (await slot.innerText()).trim();
  await slot.click();
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await expect(page.getByText(new RegExp(`at ${bookedTime}`))).toBeVisible();

  await page.getByLabel("Name").fill("Phone Booker");
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText("Enter an email or phone number")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("Phone Booker"); // typed values survive the error
  await page.getByLabel("Email").fill("phone.booker@example.com");
  await page.getByRole("button", { name: "Confirm booking" }).click();

  await expect(page).toHaveURL(/\/booking\/.+\?new=1/);
  await expect(page.getByRole("heading", { name: "You're booked, Phone!" })).toBeVisible();
  manageUrl = page.url().replace("?new=1", "");
  await expectNoSidewaysScroll(page);

  const ics = await page.request.get(new URL(manageUrl).pathname.replace("/booking/", "/api/public/bookings/") + "/ics");
  expect(await ics.text()).toContain("BEGIN:VEVENT");
});

test("the booked time is no longer offered", async ({ page }) => {
  await page.goto(`/book/${DEMO.slug}`);
  await page.getByRole("button", { name: /Gel manicure/ }).click();
  await page.locator("div.grid-cols-7 button:not([disabled])").nth(1).click();
  await expect(page.locator("div.grid-cols-3 button").first()).toBeVisible();
  expect(await page.locator("div.grid-cols-3 button").allInnerTexts()).not.toContain(bookedTime);
});

test("the salon sees it on the calendar, tagged Online", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);
  await page.goto("/dashboard/calendar?view=week");
  await expect(page.getByRole("link", { name: /Phone Booker/ })).toBeVisible();
  await expect(page.getByText("Online", { exact: true })).toBeVisible();
});

test("the client cancels from their link", async ({ page }) => {
  await page.goto(manageUrl);
  await expect(page.getByRole("heading", { name: "Your upcoming appointment" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("button", { name: "Keep booking" }).click();
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(page.getByRole("heading", { name: "Booking cancelled" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel booking" })).toHaveCount(0);
});

test("browser autofill can't trip the spam trap, but bots do", async ({ page }) => {
  await page.goto(`/book/${DEMO.slug}`);
  await page.getByRole("button", { name: /Full colour/ }).click();
  await page.locator("div.grid-cols-7 button:not([disabled])").nth(2).click();
  await page.locator("div.grid-cols-3 button").first().click();
  await expect(page.locator('input[name="hp_extra"]')).toBeHidden();
  await page.getByLabel("Name").fill("Bot");
  await page.getByLabel("Email").fill("bot@example.com");
  await page.locator('input[name="hp_extra"]').evaluate((el: HTMLInputElement) => (el.value = "http://spam.example"));
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText("Something went wrong")).toBeVisible();
});
