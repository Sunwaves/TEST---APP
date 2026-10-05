import { handle } from "@/lib/api";
import { cancelByToken } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { notifyAfterResponse, notifyCancelled } from "@/lib/messages";
import { publicBooking } from "@/lib/public";
import { appOrigin } from "@/lib/session";

export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/public/bookings/[token]/cancel">) => {
  const cancelled = await cancelByToken(prisma, (await ctx.params).token);
  const origin = await appOrigin();
  notifyAfterResponse(() => notifyCancelled(prisma, cancelled.id, origin, { byClient: true }));
  return Response.json(publicBooking(cancelled));
});
