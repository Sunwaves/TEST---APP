import { currentBusiness, handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { serviceInput } from "@/lib/validation";

export const GET = handle(async () => {
  const business = await currentBusiness();
  const services = await prisma.service.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" } });
  return Response.json(services);
});

export const POST = handle(async (req: Request) => {
  const business = await currentBusiness();
  const data = serviceInput.parse(await req.json());
  const service = await prisma.service.create({ data: { ...data, businessId: business.id } });
  return Response.json(service, { status: 201 });
});
