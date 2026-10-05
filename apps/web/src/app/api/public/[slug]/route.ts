import { handle } from "@/lib/api";
import { bookingWindow } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { businessBySlug } from "@/lib/public";

/** Everything the booking page needs to start: salon details, services and opening days. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/public/[slug]">) => {
  const business = await businessBySlug((await ctx.params).slug);
  const [services, hours] = await Promise.all([
    prisma.service.findMany({
      where: { businessId: business.id, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true, durationMinutes: true, priceCents: true },
    }),
    prisma.workingHours.findMany({
      where: { businessId: business.id },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      select: { weekday: true, startTime: true, endTime: true },
    }),
  ]);
  return Response.json({
    name: business.name,
    slug: business.slug,
    timezone: business.timezone,
    phone: business.phone,
    address: business.address,
    bookingWindow: bookingWindow(business),
    services,
    workingHours: hours,
  });
});
