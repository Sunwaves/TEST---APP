import { handle, searchParamsObject } from "@/lib/api";
import { onlineSlots } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { businessBySlug } from "@/lib/public";
import { toZonedHHMM } from "@/lib/time";
import { availabilityQuery } from "@/lib/validation";

export const GET = handle(async (req: Request, ctx: RouteContext<"/api/public/[slug]/availability">) => {
  const business = await businessBySlug((await ctx.params).slug);
  const { serviceId, date } = availabilityQuery.parse(searchParamsObject(req.url));
  const slots = await onlineSlots(prisma, business, serviceId, date);
  return Response.json({
    date,
    timezone: business.timezone,
    slots: slots.map((s) => ({ startsAt: s.toISOString(), time: toZonedHHMM(s, business.timezone) })),
  });
});
