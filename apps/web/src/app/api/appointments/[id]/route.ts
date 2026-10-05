import { currentBusiness, handle } from "@/lib/api";
import { rescheduleAppointment, updateAppointment } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { appointmentUpdate } from "@/lib/validation";

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/appointments/[id]">) => {
  const { id } = await ctx.params;
  const business = await currentBusiness();
  const { startsAt, ...rest } = appointmentUpdate.parse(await req.json());
  if (startsAt) await rescheduleAppointment(prisma, business.id, id, startsAt);
  return Response.json(await updateAppointment(prisma, business.id, id, rest));
});
