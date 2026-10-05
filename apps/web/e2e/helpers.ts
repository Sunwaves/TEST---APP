import { execSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";
import { e2eEnv } from "./env.mjs";

export const DEMO = { email: "demo@goldie.test", password: "demo1234", slug: "goldie-test-salon" };

/** Puts the demo salon back to its seeded state (and clears rate-limit counters). */
export function reseed() {
  execSync("npx prisma db seed", { env: e2eEnv, stdio: "ignore" });
}

export async function login(page: Page, email = DEMO.email, password = DEMO.password) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Selects the first <option> whose text matches. */
export async function pick(page: Page, label: string, text: RegExp) {
  const select = page.getByLabel(label);
  const value = await select.evaluate((el: HTMLSelectElement, src) => [...el.options].find((o) => new RegExp(src).test(o.text))?.value, text.source);
  await select.selectOption(value!);
}

/** Today in the demo salon's timezone, and the seed's "next weekday" (where the demo bookings are). */
export function salonToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function nextWeekday(iso = salonToday()): string {
  let day = addDays(iso, 1);
  while ([0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay())) day = addDays(day, 1);
  return day;
}

export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `page is ${overflow}px wider than the screen`).toBeLessThanOrEqual(0);
}
