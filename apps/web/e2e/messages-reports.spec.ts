import { expect, test, type Page } from "@playwright/test";
import { addDays, DEMO, login, nextWeekday, reseed } from "./helpers";

// Messages from booking events, notification settings, and reports.
test.describe.configure({ mode: "serial" });
test.beforeAll(() => reseed());

const summaries = async (page: Page) => (await page.locator("main li summary").allInnerTexts()).map((t) => t.replace(/\s+/g, " "));

test("online booking and cancellation produce the right messages", async ({ page, browser }) => {
  const client = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await client.goto(`/book/${DEMO.slug}`);
  await client.getByRole("button", { name: /Gel manicure/ }).click();
  await client.locator("div.grid-cols-7 button:not([disabled])").nth(2).click(); // 2+ days ahead, so a reminder is scheduled
  await client.locator("div.grid-cols-3 button").first().click();
  await client.getByLabel("Name").fill("Mia Message");
  await client.getByLabel("Email").fill("mia@example.com");
  await client.getByLabel("Phone").fill("07700900123");
  await client.getByRole("button", { name: "Confirm booking" }).click();
  await expect(client).toHaveURL(/\/booking\//);
  const manage = client.url().replace("?new=1", "");

  await login(page);
  await page.goto("/dashboard/messages");
  await expect(page.getByText("Test mode:")).toBeVisible();
  await expect.poll(() => summaries(page).then((l) => l.join("\n")), { intervals: [500, 1000, 2000] }).toMatch(/New booking alert · Email to demo@goldie.test.*Sent/);
  const list = (await summaries(page)).join("\n");
  expect(list).toMatch(/Confirmation · Email to mia@example.com.*Sent/);
  expect(list).toMatch(/Confirmation · SMS to 07700900123.*Sent/);
  expect(list).toMatch(/Reminder · Email to mia@example.com.*Scheduled/);
  await page.locator("main li summary", { hasText: "Confirmation · Email to mia" }).click();
  // Email and SMS bodies are identical; only the opened (email) one is visible.
  await expect(page.getByText(/Hi Mia, your Gel manicure at Goldie Test Salon is booked for/).first()).toBeVisible();

  await client.goto(manage);
  await client.getByRole("button", { name: "Cancel booking" }).click();
  await client.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(client.getByRole("heading", { name: "Booking cancelled" })).toBeVisible();
  await expect
    .poll(async () => { await page.reload(); return (await summaries(page)).join("\n"); }, { intervals: [500, 1000, 2000] })
    .toMatch(/Cancellation alert · Email to demo@goldie.test.*Sent/);
  const after = (await summaries(page)).join("\n");
  expect(after).toMatch(/Cancellation · Email to mia@example.com.*Sent/);
  expect(after).toMatch(/Reminder · Email to mia@example.com.*Not sent/);
});

test("custom template is used and reminders can be turned off", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/settings");
  const notif = page.locator("section", { hasText: "Message templates" });
  await notif.getByLabel("Send clients a reminder").uncheck();
  await notif.getByLabel("Booking confirmation").fill("Booked! {service} on {date} at {time}. Thanks {client} – {business}");
  await notif.getByRole("button", { name: "Save" }).click();
  await expect(notif.getByText("Saved")).toBeVisible();

  await page.goto(`/dashboard/appointments/new?date=${addDays(nextWeekday(), 3)}&time=19:30`);
  await page.getByLabel("Client").selectOption("new");
  await page.getByLabel("Name").fill("Tom Template");
  await page.getByLabel("Email").fill("tom@example.com");
  await page.getByRole("button", { name: "Book appointment" }).click();
  await expect(page).toHaveURL(/\/dashboard\/calendar/);

  await page.goto("/dashboard/messages");
  await expect.poll(() => summaries(page).then((l) => l.join("\n")), { intervals: [500, 1000, 2000] }).toMatch(/Confirmation · Email to tom@example.com/);
  expect((await summaries(page)).join("\n")).not.toMatch(/Reminder · Email to tom@example.com/);
  await page.locator("main li summary", { hasText: "tom@example.com" }).first().click();
  await expect(page.getByText(/^Booked! .+ on .+ at 19:30\. Thanks Tom – Goldie Test Salon$/).first()).toBeVisible();
});

test("reports show revenue, a chart with tooltip, and a table view", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/reports");
  await expect(page.getByText("Revenue per day")).toBeVisible();
  await expect(page.locator("p.text-2xl").first()).toHaveText(/£[1-9]/);
  await page.locator("button[aria-label*='completed']").nth(10).hover();
  await expect(page.locator("[role=status]").filter({ hasText: "completed" })).toBeVisible();
  await page.getByRole("link", { name: "Last 90 days" }).click();
  await expect(page.getByText("Revenue per week")).toBeVisible();
  await page.getByText("Show as table").click();
  expect(await page.locator("details table tbody tr").count()).toBeGreaterThan(5);
  await expect(page.getByRole("link", { name: /Ana Pop|Ben Ionescu|Cara Smith/ }).first()).toBeVisible();
});
