import { currentBusiness, handle, searchParamsObject } from "@/lib/api";
import { getSlots } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { toZonedHHMM } from "@/lib/time";
import { availabilityQuery } from "@/lib/validation";

export const GET = handle(async (req: Request) => {
  const business = await currentBusiness();
  const { serviceId, date } = availabilityQuery.parse(searchParamsObject(req.url));
  const slots = await getSlots(prisma, business.id, serviceId, date);
  return Response.json({
    date,
    timezone: business.timezone,
    slots: slots.map((s) => ({ startsAt: s.toISOString(), time: toZonedHHMM(s, business.timezone) })),
  });
});
