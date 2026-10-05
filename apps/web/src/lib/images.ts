import type { PrismaClient } from "@prisma/client";
import { BookingError } from "./booking";

// Salon profile photo and banner. The browser resizes pictures before upload
// (see components/image-upload.tsx); the server still checks type and size.

export type ImageKind = "AVATAR" | "BANNER";
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const FIELD: Record<ImageKind, "avatarImageId" | "bannerImageId"> = {
  AVATAR: "avatarImageId",
  BANNER: "bannerImageId",
};

/** Identifies JPEG, PNG or WebP from the file's first bytes; anything else (SVG, HTML, ...) is rejected. */
export function detectImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp"; // RIFF....WEBP
  return null;
}

export function imageUrl(id: string | null | undefined): string | null {
  return id ? `/api/images/${id}` : null;
}

/** Saves a new profile photo or banner and deletes the one it replaces. Returns the new image id. */
export async function saveBusinessImage(db: PrismaClient, businessId: string, kind: ImageKind, bytes: Uint8Array) {
  if (!bytes.length) throw new BookingError("Choose a picture to upload");
  if (bytes.length > MAX_IMAGE_BYTES) throw new BookingError("That picture is too large (2 MB max)");
  const contentType = detectImageType(bytes);
  if (!contentType) throw new BookingError("Please upload a JPEG, PNG or WebP picture");

  return db.$transaction(async (tx) => {
    const business = await tx.business.findUniqueOrThrow({ where: { id: businessId } });
    const image = await tx.image.create({ data: { businessId, kind, contentType, data: Buffer.from(bytes) } });
    await tx.business.update({ where: { id: businessId }, data: { [FIELD[kind]]: image.id } });
    const old = business[FIELD[kind]];
    if (old) await tx.image.deleteMany({ where: { id: old, businessId } });
    return image.id;
  });
}

export async function removeBusinessImage(db: PrismaClient, businessId: string, kind: ImageKind) {
  await db.$transaction(async (tx) => {
    const business = await tx.business.findUniqueOrThrow({ where: { id: businessId } });
    const old = business[FIELD[kind]];
    await tx.business.update({ where: { id: businessId }, data: { [FIELD[kind]]: null } });
    if (old) await tx.image.deleteMany({ where: { id: old, businessId } });
  });
}
