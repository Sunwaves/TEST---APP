import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createSession, deleteSession, userForSession } from "./auth";
import { prisma } from "./db";

// Cookie/header side of login sessions. Browsers use an httpOnly cookie;
// API clients (the future mobile app) can send `Authorization: Bearer <token>`.

export const SESSION_COOKIE = "goldie_session";

async function sessionToken(): Promise<string | undefined> {
  const fromCookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (fromCookie) return fromCookie;
  const auth = (await headers()).get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
}

/** The logged-in user with their business, or null. Cached per request. */
export const getCurrentUser = cache(async () => userForSession(prisma, await sessionToken()));

export async function startSession(userId: string) {
  const { token, expiresAt } = await createSession(prisma, userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function endSession() {
  const token = await sessionToken();
  if (token) await deleteSession(prisma, token);
  (await cookies()).delete(SESSION_COOKIE);
}

/** Absolute base URL for links in emails, e.g. https://example.com. */
export async function appOrigin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
