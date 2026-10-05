import { z } from "zod";
import { BookingError } from "./booking";
import { prisma } from "./db";

/**
 * The business the dashboard acts on. Until auth lands (a later phase),
 * this app runs a single business: the first one in the database.
 */
export async function currentBusiness() {
  const business = await prisma.business.findFirst({ orderBy: { createdAt: "asc" } });
  if (!business) throw new BookingError("No business set up. Run `npm run db:seed`.", 500);
  return business;
}

export function searchParamsObject(url: string) {
  return Object.fromEntries(new URL(url).searchParams);
}

/** Wraps a route handler so validation and booking errors become JSON responses. */
export function handle<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return Response.json({ error: "Invalid request", issues: err.issues }, { status: 400 });
      }
      if (err instanceof BookingError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof SyntaxError) {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      console.error(err);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
