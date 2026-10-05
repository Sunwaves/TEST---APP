"use client"; // error boundaries must be client components

import Link from "next/link";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <span aria-hidden className="mb-4 block size-10 rounded-full bg-red-300" />
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-stone-600">Please try again. If it keeps happening, let us know{error.digest ? ` (reference ${error.digest})` : ""}.</p>
      <div className="mt-6 flex gap-3">
        <button onClick={() => retry()} className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
          Try again
        </button>
        <Link href="/" className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-100">
          Home
        </Link>
      </div>
    </main>
  );
}
