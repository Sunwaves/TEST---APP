import { currentBusiness, handle } from "@/lib/api";
import { setWorkingHours } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { workingHoursInput } from "@/lib/validation";

/** Replaces the whole weekly schedule. */
export const PUT = handle(async (req: Request) => {
  const business = await currentBusiness();
  const hours = workingHoursInput.parse(await req.json());
  return Response.json(await setWorkingHours(prisma, business.id, hours));
});
