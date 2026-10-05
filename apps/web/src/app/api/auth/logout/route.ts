import { handle } from "@/lib/api";
import { endSession } from "@/lib/session";

export const POST = handle(async () => {
  await endSession();
  return Response.json({ ok: true });
});
