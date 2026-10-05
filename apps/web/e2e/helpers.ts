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

/** A real PNG file of one colour (with a stripe so crops are visible), for upload tests. */
export function makePng(width: number, height: number, rgb: [number, number, number]): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const zlib = require("node:zlib") as typeof import("node:zlib");
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) {
      const stripe = Math.abs(x - y) < Math.max(4, width / 40);
      row.set(stripe ? [255, 255, 255] : rgb, 1 + x * 3);
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
