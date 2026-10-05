import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { deliverDue } from "@/lib/messages/notify";

/**
 * Delivers due messages (reminders). For hosts with cron jobs, e.g. Vercel Cron:
 * call every few minutes with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await deliverDue(prisma));
}
