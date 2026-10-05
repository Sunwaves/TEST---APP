import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "./session";

/** For dashboard pages: renders per request and sends logged-out visitors to the login page. */
export async function dashboardUser() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function dashboardBusiness() {
  return (await dashboardUser()).business;
}
