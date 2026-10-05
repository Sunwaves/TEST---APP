import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthForm } from "@/components/auth-form";
import { Field, Input } from "@/components/ui";
import { DEMO_EMAIL } from "@/lib/accounts";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { login } from "../actions";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  await connection();
  if (await getCurrentUser()) redirect("/dashboard");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  const showDemo = process.env.NODE_ENV !== "production" && (await prisma.user.count({ where: { email: DEMO_EMAIL } })) > 0;

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Log in</h1>
      <p className="mb-5 text-sm text-stone-600">to manage your salon&apos;s bookings.</p>
      {params.reset === "1" && (
        <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Password changed. Log in with your new password.</p>
      )}
      <AuthForm action={login} submitLabel="Log in">
        <input type="hidden" name="next" value={next} />
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
      </AuthForm>
      <div className="mt-4 flex justify-between text-sm">
        <Link href="/forgot-password" className="text-stone-600 underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="font-medium underline">
          Create an account
        </Link>
      </div>
      {showDemo && (
        <p className="mt-5 rounded-md bg-stone-100 px-3 py-2 text-xs text-stone-700">
          Demo login (development only): <strong>{DEMO_EMAIL}</strong> / <strong>demo1234</strong>
        </p>
      )}
    </>
  );
}
