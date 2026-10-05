import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <span aria-hidden className="mb-4 block size-10 rounded-full bg-amber-400" />
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-stone-600">This page doesn&apos;t exist, or the link has expired.</p>
      <Link href="/" className="mt-6 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
        Go to the home page
      </Link>
    </main>
  );
}
