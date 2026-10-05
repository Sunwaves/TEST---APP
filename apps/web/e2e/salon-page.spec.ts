import { expect, test } from "@playwright/test";
import { DEMO, expectNoSidewaysScroll, login, makePng, reseed } from "./helpers";

// The public salon page (social-profile style) and editing it from the dashboard.
test.describe.configure({ mode: "serial" });
test.beforeAll(() => reseed());

test("public page: header, about, services, hours; a service card opens the booking steps", async ({ page }) => {
  await page.goto(`/book/${DEMO.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: "Goldie Test Salon" })).toBeVisible();
  await expect(page.getByText(/^(Open now · until \d\d:\d\d|Closed now)$/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
  await expect(page.getByText("A friendly neighbourhood salon")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Opening hours" })).toBeVisible();
  await expect(page.getByText("14:00–18:00", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in Maps" })).toHaveAttribute("href", /google\.com\/maps/);
  await expect(page.getByText("GT", { exact: true })).toBeVisible(); // initials when there is no photo

  await page.getByRole("link", { name: "Book now" }).click();
  await expect(page).toHaveURL(/#services$/);
  await page.getByRole("button", { name: /Haircut/ }).click();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await expect(page.getByText(/^Haircut · 45 min$/)).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
});

test("owner uploads a photo and banner and edits the description", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/profile");
  await expect(page.getByRole("heading", { name: "Salon page" })).toBeVisible();

  // A big "camera" photo: resized in the browser before upload.
  const uploads: number[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/business/images") && r.method() === "POST") uploads.push(r.postDataBuffer()?.length ?? 0);
  });
  await page.getByLabel("Photo", { exact: true }).setInputFiles({ name: "me.png", mimeType: "image/png", buffer: makePng(2400, 1800, [190, 80, 120]) });
  await expect(page.getByText("Uploaded")).toBeVisible();
  await expect(page.getByRole("img", { name: "Goldie Test Salon profile photo" })).toBeVisible();
  expect(uploads[0]).toBeLessThan(300_000);

  await page.getByLabel("Banner", { exact: true }).setInputFiles({ name: "salon.png", mimeType: "image/png", buffer: makePng(1200, 900, [60, 120, 160]) });
  await expect(page.getByRole("button", { name: "Change banner" })).toBeVisible();

  const about = page.locator("section", { hasText: "Description" });
  await about.getByLabel(/^Description/).fill("Colour specialists.\nOpen late on Thursdays.");
  await about.getByRole("button", { name: "Save" }).click();
  await expect(about.getByText("Saved")).toBeVisible();

  // The served pictures are real, resized JPEGs.
  const avatarSrc = await page.getByRole("img", { name: "Goldie Test Salon profile photo" }).getAttribute("src");
  const res = await page.request.get(avatarSrc!);
  expect(res.headers()["content-type"]).toBe("image/jpeg");
  expect(res.headers()["cache-control"]).toContain("immutable");
  const size = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, avatarSrc!);
  expect(size).toEqual([512, 512]);

  await page.goto(`/book/${DEMO.slug}`);
  await expect(page.getByRole("img", { name: "Goldie Test Salon profile photo" })).toBeVisible();
  await expect(page.getByText("Open late on Thursdays.")).toBeVisible();
  await expectNoSidewaysScroll(page);

  // Remove the photo again: initials come back.
  await page.goto("/dashboard/profile");
  await page.getByRole("button", { name: "Change photo" }).locator("..").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeVisible();
});

test("uploads are refused for strangers and for non-images", async ({ page, request }) => {
  const anon = await request.post("/api/business/images", { multipart: { kind: "AVATAR", file: { name: "a.png", mimeType: "image/png", buffer: makePng(10, 10, [0, 0, 0]) } } });
  expect(anon.status()).toBe(401);

  await login(page);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const res = await page.request.post("/api/business/images", { multipart: { kind: "BANNER", file: { name: "evil.png", mimeType: "image/png", buffer: svg } } });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toContain("JPEG, PNG or WebP");
});

test("salon page fits on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/book/${DEMO.slug}`);
  await expectNoSidewaysScroll(page);
});
