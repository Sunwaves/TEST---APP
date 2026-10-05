import { z } from "zod";
import { currentBusiness, handle, searchParamsObject } from "@/lib/api";
import { BookingError } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { imageUrl, removeBusinessImage, saveBusinessImage } from "@/lib/images";

const kind = z.enum(["AVATAR", "BANNER"]);

/** Upload the salon's profile photo or banner: multipart form with `kind` and `file`. */
export const POST = handle(async (req: Request) => {
  const business = await currentBusiness();
  const form = await req.formData().catch(() => {
    throw new BookingError("Expected a file upload");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new BookingError("Choose a picture to upload");
  const id = await saveBusinessImage(prisma, business.id, kind.parse(form.get("kind")), new Uint8Array(await file.arrayBuffer()));
  return Response.json({ id, url: imageUrl(id) }, { status: 201 });
});

/** Remove it again: DELETE /api/business/images?kind=AVATAR */
export const DELETE = handle(async (req: Request) => {
  const business = await currentBusiness();
  await removeBusinessImage(prisma, business.id, kind.parse(searchParamsObject(req.url).kind));
  return Response.json({ ok: true });
});
