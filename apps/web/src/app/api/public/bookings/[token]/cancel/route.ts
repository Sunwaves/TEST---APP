import { handle } from "@/lib/api";
import { cancelByToken } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { publicBooking } from "@/lib/public";

export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/public/bookings/[token]/cancel">) => {
  return Response.json(publicBooking(await cancelByToken(prisma, (await ctx.params).token)));
});
