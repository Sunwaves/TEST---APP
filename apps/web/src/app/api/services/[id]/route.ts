import { currentBusiness, handle } from "@/lib/api";
import { BookingError } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { serviceInput } from "@/lib/validation";

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/services/[id]">) => {
  const { id } = await ctx.params;
  const business = await currentBusiness();
  const data = serviceInput.partial().parse(await req.json());
  const { count } = await prisma.service.updateMany({ where: { id, businessId: business.id }, data });
  if (!count) throw new BookingError("Service not found", 404);
  return Response.json(await prisma.service.findUnique({ where: { id } }));
});
