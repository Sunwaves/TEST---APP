import { currentBusiness, handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { businessInput } from "@/lib/validation";

async function withHours(businessId: string) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const workingHours = await prisma.workingHours.findMany({
    where: { businessId },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
  return { ...business, workingHours };
}

export const GET = handle(async () => {
  const business = await currentBusiness();
  return Response.json(await withHours(business.id));
});

export const PATCH = handle(async (req: Request) => {
  const business = await currentBusiness();
  const data = businessInput.partial().parse(await req.json());
  await prisma.business.update({ where: { id: business.id }, data });
  return Response.json(await withHours(business.id));
});
