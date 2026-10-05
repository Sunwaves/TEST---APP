import { currentBusiness, handle } from "@/lib/api";
import { rescheduleAppointment, updateAppointment } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { notifyAfterResponse, notifyRescheduled, notifyStatusChange } from "@/lib/messages";
import { appOrigin } from "@/lib/session";
import { appointmentUpdate } from "@/lib/validation";

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/appointments/[id]">) => {
  const { id } = await ctx.params;
  const business = await currentBusiness();
  const { startsAt, ...rest } = appointmentUpdate.parse(await req.json());
  const origin = await appOrigin();
  if (startsAt) {
    await rescheduleAppointment(prisma, business.id, id, startsAt);
    notifyAfterResponse(() => notifyRescheduled(prisma, id, origin));
  }
  const { previousStatus, ...appointment } = await updateAppointment(prisma, business.id, id, rest);
  notifyAfterResponse(() => notifyStatusChange(prisma, id, previousStatus, appointment.status, origin));
  return Response.json(appointment);
});
