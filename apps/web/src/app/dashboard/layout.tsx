import Link from "next/link";
import { connection } from "next/server";
import { logout } from "@/app/(auth)/actions";
import { NavLinks } from "@/components/nav-links";
import { getCurrentUser } from "@/lib/session";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  await connection();
  // Header only. Each page checks the session itself (dashboardBusiness), as layouts don't re-run on navigation.
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard/calendar" className="flex items-center gap-2 font-semibold">
              <span aria-hidden className="inline-block size-3 rounded-full bg-amber-400" />
              {user?.business.name ?? "Goldie Test App"}
            </Link>
            {user && (
              <form action={logout} className="lg:hidden">
                <button className="text-sm text-stone-600 underline">Log out</button>
              </form>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <NavLinks />
              <Link
                href={`/book/${user.business.slug}`}
                target="_blank"
                className="hidden rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-stone-700 hover:bg-stone-100 xl:inline-block"
              >
                Booking page ↗
              </Link>
              <form action={logout} className="hidden lg:block">
                <button className="rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-stone-600 hover:bg-stone-100" title={user.email}>
                  Log out
                </button>
              </form>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
