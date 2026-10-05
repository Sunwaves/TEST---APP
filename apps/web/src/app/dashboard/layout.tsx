import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { prisma } from "@/lib/db";
import { connection } from "next/server";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  await connection();
  const business = await prisma.business.findFirst({ orderBy: { createdAt: "asc" } });

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard/calendar" className="flex items-center gap-2 font-semibold">
            <span aria-hidden className="inline-block size-3 rounded-full bg-amber-400" />
            {business?.name ?? "Goldie Test App"}
          </Link>
          <div className="flex items-center gap-2">
            <NavLinks />
            {business && (
              <Link
                href={`/book/${business.slug}`}
                target="_blank"
                className="hidden rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-stone-700 hover:bg-stone-100 md:inline-block"
              >
                Booking page ↗
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {business ? (
          children
        ) : (
          <p>
            No business yet. Run <code>npm run db:seed</code> in <code>apps/web</code>.
          </p>
        )}
      </main>
    </div>
  );
}
