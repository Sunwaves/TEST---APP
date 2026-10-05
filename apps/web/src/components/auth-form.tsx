"use client";

import { useActionState, type ReactNode } from "react";
import type { AuthFormState } from "@/app/(auth)/actions";
import { submitKeepingValues } from "./action-form";
import { buttonClass } from "./ui";

export function AuthForm({
  action,
  submitLabel,
  children,
}: {
  action: (prev: AuthFormState, fd: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form onSubmit={submitKeepingValues(formAction)} className="flex flex-col gap-4">
      {children}
      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state.message && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{state.message}</p>}
      {state.devLink && (
        <p className="rounded-md border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-xs break-all text-amber-950">
          Email is simulated in development, so here is the link it contains:{" "}
          <a href={state.devLink} className="font-medium underline">
            {state.devLink}
          </a>
        </p>
      )}
      <button type="submit" disabled={pending} className={`${buttonClass.primary} py-2.5`}>
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
