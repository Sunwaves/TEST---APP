import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { DEMO_EMAIL } from "@/lib/accounts";

export default async function Home() {
  await connection();
  const demo = await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, include: { business: true } });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
      <span aria-hidden className="mx-auto mb-4 block size-12 rounded-full bg-amber-400" />
      <h1 className="text-3xl font-semibold">Goldie Test App</h1>
      <p className="mt-3 text-stone-600">
        Appointment booking for beauty professionals: a calendar, client records, an online booking page, reminders and reports.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/login" className="rounded-md bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700">
          Log in
        </Link>
        <Link href="/signup" className="rounded-md border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium hover:bg-stone-100">
          Create your salon
        </Link>
      </div>
      {demo && (
        <p className="mt-8 text-sm text-stone-600">
          Try the demo salon&apos;s{" "}
          <Link href={`/book/${demo.business.slug}`} className="font-medium underline">
            booking page
          </Link>
          {process.env.NODE_ENV !== "production" && (
            <>
              , or log in as <strong>{DEMO_EMAIL}</strong> / <strong>demo1234</strong>
            </>
          )}
          .
        </p>
      )}
    </main>
  );
}
