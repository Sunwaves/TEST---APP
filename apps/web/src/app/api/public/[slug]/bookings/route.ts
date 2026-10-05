import { handle } from "@/lib/api";
import { bookAppointment } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { alertLimitReached, notifyAfterResponse, notifyBooked } from "@/lib/messages";
import { LimitReachedError } from "@/lib/plans";
import { businessBySlug, publicBooking } from "@/lib/public";
import { clientIp, enforceLimit } from "@/lib/limits";
import { appOrigin } from "@/lib/session";
import { onlineBookingInput } from "@/lib/validation";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/public/[slug]/bookings">) => {
  await enforceLimit("booking", await clientIp());
  const business = await businessBySlug((await ctx.params).slug);
  const { serviceId, startsAt, notes, ...client } = onlineBookingInput.parse(await req.json());
  const origin = await appOrigin();
  const appointment = await bookAppointment(prisma, business.id, { serviceId, startsAt, notes, client, source: "ONLINE" }).catch((err) => {
    if (err instanceof LimitReachedError) notifyAfterResponse(() => alertLimitReached(prisma, business.id, origin));
    throw err;
  });
  notifyAfterResponse(() => notifyBooked(prisma, appointment.id, origin));
  return Response.json(publicBooking({ ...appointment, business }), { status: 201 });
});
