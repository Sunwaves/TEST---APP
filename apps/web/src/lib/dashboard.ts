import { connection } from "next/server";
import { currentBusiness } from "./api";

/** For dashboard pages: opts out of build-time prerendering, then loads the business. */
export async function dashboardBusiness() {
  await connection();
  return currentBusiness();
}
