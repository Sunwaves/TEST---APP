"use client";

import { useActionState, useState } from "react";
import { cancelOnlineBooking } from "@/app/book/actions";
import { buttonClass } from "./ui";

export function CancelBooking({ token }: { token: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(cancelOnlineBooking.bind(null, token), {});

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonClass.danger}>
        Cancel booking
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg bg-red-50 p-4">
      <p className="text-sm text-red-900">Cancel this appointment? The time will be released for other clients.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={`${buttonClass.primary} bg-red-700 hover:bg-red-800`}>
          {pending ? "Cancelling…" : "Yes, cancel it"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={buttonClass.secondary}>
          Keep booking
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-800">
          {state.error}
        </p>
      )}
    </form>
  );
}
