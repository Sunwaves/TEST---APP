import { handle } from "@/lib/api";
import { bookingByToken, publicBooking } from "@/lib/public";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/public/bookings/[token]">) => {
  return Response.json(publicBooking(await bookingByToken((await ctx.params).token)));
});
