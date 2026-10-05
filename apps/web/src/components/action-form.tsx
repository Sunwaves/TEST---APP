"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import type { FormState } from "@/app/dashboard/actions";
import { buttonClass } from "./ui";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/**
 * A form bound to a server action: shows pending state, the error message,
 * or a short success note. Optionally clears its inputs after success.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  variant = "primary",
  resetOnSuccess = false,
  className = "flex flex-col gap-4",
}: {
  action: Action;
  children?: ReactNode;
  submitLabel?: string;
  variant?: keyof typeof buttonClass;
  resetOnSuccess?: boolean;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={formRef} onSubmit={submitKeepingValues(formAction)} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass[variant]}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <p aria-live="polite" className="text-sm">
          {state.error && <span className="text-red-700">{state.error}</span>}
          {state.ok && state.message && <span className="text-emerald-700">{state.message}</span>}
        </p>
      </div>
    </form>
  );
}

/**
 * Submits through the action without React's automatic form reset,
 * so typed values survive a validation or clash error.
 */
export function submitKeepingValues(action: (fd: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    startTransition(() => action(fd));
  };
}
