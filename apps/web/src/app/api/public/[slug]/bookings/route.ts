import { handle } from "@/lib/api";
import { bookAppointment } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { businessBySlug, publicBooking } from "@/lib/public";
import { onlineBookingInput } from "@/lib/validation";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/public/[slug]/bookings">) => {
  const business = await businessBySlug((await ctx.params).slug);
  const { serviceId, startsAt, notes, ...client } = onlineBookingInput.parse(await req.json());
  const appointment = await bookAppointment(prisma, business.id, { serviceId, startsAt, notes, client, source: "ONLINE" });
  return Response.json(publicBooking({ ...appointment, business }), { status: 201 });
});
