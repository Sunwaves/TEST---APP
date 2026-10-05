import { currentBusiness, handle } from "@/lib/api";
import { prisma } from "@/lib/db";

export const GET = handle(async () => {
  const business = await currentBusiness();
  const workingHours = await prisma.workingHours.findMany({
    where: { businessId: business.id },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
  return Response.json({ ...business, workingHours });
});
