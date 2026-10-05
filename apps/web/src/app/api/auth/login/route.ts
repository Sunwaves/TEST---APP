import { z } from "zod";
import { handle } from "@/lib/api";
import { checkLogin, createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** For API clients (the mobile app): returns a token to send as `Authorization: Bearer <token>`. */
export const POST = handle(async (req: Request) => {
  const { email, password } = z.object({ email: z.string(), password: z.string() }).parse(await req.json());
  const user = await checkLogin(prisma, email, password);
  if (!user) return Response.json({ error: "Wrong email or password" }, { status: 401 });
  const { token, expiresAt } = await createSession(prisma, user.id);
  return Response.json({ token, expiresAt, user: { name: user.name, email: user.email } });
});
