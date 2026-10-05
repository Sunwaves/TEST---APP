"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAccount } from "@/lib/accounts";
import { checkLogin, createPasswordReset, resetPassword } from "@/lib/auth";
import { BookingError } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { deliverDue, queuePasswordReset } from "@/lib/messages/notify";
import { deliveryMode } from "@/lib/messages/drivers";
import { clientIp, enforceLimit } from "@/lib/limits";
import { appOrigin, endSession, startSession } from "@/lib/session";

export interface AuthFormState {
  error?: string;
  message?: string;
  devLink?: string; // shown only while email is simulated in development
}

function field(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const password = z.string().min(8, "Password must be at least 8 characters").max(200);

/** Only relative paths inside the dashboard, so `next` can't redirect to another site. */
function safeNext(value: string): string {
  return value.startsWith("/dashboard") ? value : "/dashboard";
}

/** Runs a rate limit check and turns a 429 into a form error. */
async function limited(check: () => Promise<void>): Promise<AuthFormState | null> {
  try {
    await check();
    return null;
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message };
    throw err;
  }
}

export async function login(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const ip = await clientIp();
  const blocked = await limited(async () => {
    await enforceLimit("loginIp", ip);
    await enforceLimit("login", `${ip}:${field(fd, "email")}`);
  });
  if (blocked) return blocked;
  const user = await checkLogin(prisma, field(fd, "email"), String(fd.get("password") ?? ""));
  if (!user) return { error: "Wrong email or password." };
  await startSession(user.id);
  redirect(safeNext(field(fd, "next")));
}

export async function signup(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({
      name: z.string().min(1, "Enter your name").max(100),
      salonName: z.string().min(1, "Enter your salon's name").max(100),
      email: z.email("Enter a valid email"),
      password,
    })
    .safeParse({ name: field(fd, "name"), salonName: field(fd, "salonName"), email: field(fd, "email"), password: String(fd.get("password") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ip = await clientIp();
  const blocked = await limited(() => enforceLimit("signup", ip));
  if (blocked) return blocked;

  try {
    const user = await createAccount(prisma, parsed.data);
    await startSession(user.id);
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message };
    throw err;
  }
  redirect("/dashboard/services?welcome=1");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function requestPasswordReset(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const email = field(fd, "email");
  if (!z.email().safeParse(email).success) return { error: "Enter a valid email." };
  const ip = await clientIp();
  const blocked = await limited(() => enforceLimit("passwordReset", ip, email));
  if (blocked) return blocked;

  const reset = await createPasswordReset(prisma, email);
  let devLink: string | undefined;
  if (reset) {
    const link = `${await appOrigin()}/reset-password/${reset.token}`;
    await queuePasswordReset(prisma, reset.user, link);
    await deliverDue(prisma);
    if (process.env.NODE_ENV !== "production" && deliveryMode("EMAIL") === "simulated") devLink = link;
  }
  // Same answer whether or not the account exists, so this can't be used to probe emails.
  return { message: "If an account exists for that email, we've sent a link to reset the password.", devLink };
}

export async function chooseNewPassword(token: string, _prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const parsed = password.safeParse(String(fd.get("password") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (String(fd.get("password")) !== String(fd.get("confirm"))) return { error: "The two passwords don't match." };
  if (!(await resetPassword(prisma, token, parsed.data))) return { error: "This reset link has expired or was already used." };
  redirect("/login?reset=1");
}
