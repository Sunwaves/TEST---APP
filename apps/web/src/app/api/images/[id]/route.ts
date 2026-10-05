import { prisma } from "@/lib/db";

/** Serves an uploaded salon picture. Ids change on every upload, so browsers may cache forever. */
export async function GET(_req: Request, ctx: RouteContext<"/api/images/[id]">) {
  const image = await prisma.image.findUnique({ where: { id: (await ctx.params).id } });
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'", // belt and braces: never run anything from an image URL
    },
  });
}
