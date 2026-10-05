import { z } from "zod";
import { BookingError } from "./booking";
import { getCurrentUser } from "./session";

/** The logged-in user's business. Every staff page, action and API route goes through this check. */
export async function currentBusiness() {
  const user = await getCurrentUser();
  if (!user) throw new BookingError("Please log in", 401);
  return user.business;
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
