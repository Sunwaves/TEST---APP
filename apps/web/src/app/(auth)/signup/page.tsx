import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { Field, Input } from "@/components/ui";
import { signup } from "../actions";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Create your salon</h1>
      <p className="mb-5 text-sm text-stone-600">Get a booking page and calendar in a minute.</p>
      <AuthForm action={signup} submitLabel="Create account">
        <Field label="Your name">
          <Input name="name" autoComplete="name" required />
        </Field>
        <Field label="Salon name" hint="Also used for your booking page address">
          <Input name="salonName" autoComplete="organization" required />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
      </AuthForm>
      <p className="mt-4 text-center text-sm text-stone-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Log in
        </Link>
      </p>
    </>
  );
}
