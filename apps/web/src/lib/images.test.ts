import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BookingError } from "./booking";
import { detectImageType, MAX_IMAGE_BYTES, removeBusinessImage, saveBusinessImage } from "./images";

const db = new PrismaClient();
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
let businessId: string;

beforeEach(async () => {
  await db.business.deleteMany();
  businessId = (await db.business.create({ data: { name: "Glow", slug: "glow" } })).id;
});
afterAll(() => db.$disconnect());

describe("images", () => {
  it("recognises JPEG, PNG and WebP by content and rejects everything else", () => {
    expect(detectImageType(JPEG)).toBe("image/jpeg");
    expect(detectImageType(PNG)).toBe("image/png");
    expect(detectImageType(WEBP)).toBe("image/webp");
    expect(detectImageType(SVG)).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });

  it("saves, replaces (deleting the old file) and removes a profile photo", async () => {
    const first = await saveBusinessImage(db, businessId, "AVATAR", PNG);
    expect((await db.business.findUniqueOrThrow({ where: { id: businessId } })).avatarImageId).toBe(first);

    const second = await saveBusinessImage(db, businessId, "AVATAR", JPEG);
    const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });
    expect(business.avatarImageId).toBe(second);
    expect(await db.image.findUnique({ where: { id: first } })).toBeNull();
    expect((await db.image.findUniqueOrThrow({ where: { id: second } })).contentType).toBe("image/jpeg");

    await saveBusinessImage(db, businessId, "BANNER", WEBP); // independent slot
    await removeBusinessImage(db, businessId, "AVATAR");
    const after = await db.business.findUniqueOrThrow({ where: { id: businessId } });
    expect(after.avatarImageId).toBeNull();
    expect(after.bannerImageId).not.toBeNull();
    expect(await db.image.count({ where: { businessId } })).toBe(1);
  });

  it("rejects disguised, empty and oversized files", async () => {
    for (const bytes of [SVG, new Uint8Array(), new Uint8Array(MAX_IMAGE_BYTES + 1).fill(0xff)]) {
      await expect(saveBusinessImage(db, businessId, "BANNER", bytes)).rejects.toBeInstanceOf(BookingError);
    }
    expect(await db.image.count()).toBe(0);
  });
});
