import { handle } from "@/lib/api";
import { bookingByToken, bookingIcs } from "@/lib/public";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/public/bookings/[token]/ics">) => {
  const appointment = await bookingByToken((await ctx.params).token);
  return new Response(bookingIcs(appointment), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="appointment.ics"`,
    },
  });
});
