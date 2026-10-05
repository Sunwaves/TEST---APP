import { currentBusiness, handle } from "@/lib/api";
import { BookingError } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { clientInput } from "@/lib/validation";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/clients/[id]">) => {
  const { id } = await ctx.params;
  const business = await currentBusiness();
  const client = await prisma.client.findFirst({
    where: { id, businessId: business.id },
    include: { appointments: { include: { service: true }, orderBy: { startsAt: "desc" } } },
  });
  if (!client) throw new BookingError("Client not found", 404);
  return Response.json(client);
});

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/clients/[id]">) => {
  const { id } = await ctx.params;
  const business = await currentBusiness();
  const data = clientInput.partial().parse(await req.json());
  const { count } = await prisma.client.updateMany({ where: { id, businessId: business.id }, data });
  if (!count) throw new BookingError("Client not found", 404);
  return Response.json(await prisma.client.findUnique({ where: { id } }));
});
