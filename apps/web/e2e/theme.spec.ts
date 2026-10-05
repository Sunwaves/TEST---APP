import { expect, test } from "@playwright/test";
import { DEMO, login } from "./helpers";

// Light/dark theme: follows the device until chosen, then remembered per browser (cookie).
const bodyBackground = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const isDark = async (page: import("@playwright/test").Page) => {
  // Average of the RGB channels of the page background: dark themes are well below the middle.
  const rgb = (await bodyBackground(page)).match(/[\d.]+/g)!.slice(0, 3).map(Number);
  return rgb.reduce((a, b) => a + b, 0) / 3 < 100;
};

test("follows the device setting when nothing is chosen", async ({ browser }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme });
    const page = await context.newPage();
    await page.goto(`/book/${DEMO.slug}`);
    expect(await isDark(page)).toBe(colorScheme === "dark");
    await context.close();
  }
});

test("the switch changes the theme and the choice is remembered", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ colorScheme: "light" });

  await page.goto(`/book/${DEMO.slug}`);
  expect(await isDark(page)).toBe(false);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await isDark(page)).toBe(true);

  // Remembered: the server sends the dark theme straight away on the next page (no flash).
  const html = await (await page.request.get("/login")).text();
  expect(html).toMatch(/<html[^>]*data-theme="dark"/);
  await page.goto("/login");
  expect(await isDark(page)).toBe(true);

  // Also in the dashboard header, and back to light.
  await login(page);
  await page.getByRole("button", { name: "Switch to light theme" }).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  expect(await isDark(page)).toBe(false);
  expect(errors).toEqual([]);
});

test("a dark-device visitor can choose light", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/");
  expect(await isDark(page)).toBe(true);
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.reload();
  expect(await isDark(page)).toBe(false);
  await context.close();
});
