import { currentBusiness, handle, searchParamsObject } from "@/lib/api";
import { bookAppointment } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { appointmentInput, rangeQuery } from "@/lib/validation";

export const GET = handle(async (req: Request) => {
  const business = await currentBusiness();
  const { from, to } = rangeQuery.parse(searchParamsObject(req.url));
  const appointments = await prisma.appointment.findMany({
    where: { businessId: business.id, startsAt: { lt: to }, endsAt: { gt: from } },
    include: { service: true, client: true },
    orderBy: { startsAt: "asc" },
  });
  return Response.json(appointments);
});

export const POST = handle(async (req: Request) => {
  const business = await currentBusiness();
  const data = appointmentInput.parse(await req.json());
  const appointment = await bookAppointment(prisma, business.id, { ...data, source: "STAFF" });
  return Response.json(appointment, { status: 201 });
});
