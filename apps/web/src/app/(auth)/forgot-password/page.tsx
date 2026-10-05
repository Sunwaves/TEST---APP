import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { Field, Input } from "@/components/ui";
import { requestPasswordReset } from "../actions";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Forgot your password?</h1>
      <p className="mb-5 text-sm text-stone-600">We&apos;ll email you a link to choose a new one.</p>
      <AuthForm action={requestPasswordReset} submitLabel="Send reset link">
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
      </AuthForm>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}
