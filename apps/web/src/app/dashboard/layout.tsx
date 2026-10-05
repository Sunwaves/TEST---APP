import Link from "next/link";
import { connection } from "next/server";
import { logout } from "@/app/(auth)/actions";
import { NavLinks } from "@/components/nav-links";
import { PlanBadge } from "@/components/plan-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { prisma } from "@/lib/db";
import { usageOf } from "@/lib/plans";
import { getCurrentUser } from "@/lib/session";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  await connection();
  // Header only. Each page checks the session itself (dashboardBusiness), as layouts don't re-run on navigation.
  const user = await getCurrentUser();
  const usage = user ? await usageOf(prisma, user.business) : null;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Link href="/dashboard/calendar" className="flex min-w-0 items-center gap-2 font-semibold">
                <span aria-hidden className="inline-block size-3 shrink-0 rounded-full bg-amber-400" />
                <span className="truncate">{user?.business.name ?? "BookMe"}</span>
              </Link>
              {usage && <PlanBadge pro={usage.pro} used={usage.used} limit={usage.limit} warn={usage.warn} paused={usage.onlinePaused} />}
            </div>
            {user && (
              <div className="flex items-center gap-1 lg:hidden">
                <ThemeToggle />
                <form action={logout}>
                  <button className="text-sm text-stone-600 underline">Log out</button>
                </form>
              </div>
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
              <ThemeToggle className="hidden lg:inline-flex" />
              <form action={logout} className="hidden lg:block">
                <button className="rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-stone-600 hover:bg-stone-100" title={user.email}>
                  Log out
                </button>
              </form>
            </div>
          )}
        </div>
      </header>
      {usage && (usage.warn || usage.pastDue) && (
        <div role="status" className={`border-b px-4 py-2 text-center text-sm ${usage.onlinePaused || usage.pastDue ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
          {usage.pastDue
            ? "Your last PRO payment didn't go through. "
            : usage.onlinePaused
              ? "You've used all your free bookings this month, so online booking is paused. "
              : `${usage.remaining} free booking${usage.remaining === 1 ? "" : "s"} left this month. `}
          <Link href="/dashboard/billing" className="font-semibold underline">
            {usage.pastDue ? "Update your card" : "Upgrade to PRO"}
          </Link>
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
