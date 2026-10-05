import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AuthForm } from "@/components/auth-form";
import { Field, Input } from "@/components/ui";
import { findPasswordReset } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { chooseNewPassword } from "../../actions";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  await connection();
  const { token } = await params;
  const valid = await findPasswordReset(prisma, token);

  if (!valid) {
    return (
      <>
        <h1 className="mb-2 text-xl font-semibold">Link expired</h1>
        <p className="mb-4 text-sm text-stone-600">This reset link has expired or was already used.</p>
        <Link href="/forgot-password" className="text-sm font-medium underline">
          Request a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-5 text-xl font-semibold">Choose a new password</h1>
      <AuthForm action={chooseNewPassword.bind(null, token)} submitLabel="Save new password">
        <Field label="New password" hint="At least 8 characters">
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Repeat new password">
          <Input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
      </AuthForm>
    </>
  );
}
