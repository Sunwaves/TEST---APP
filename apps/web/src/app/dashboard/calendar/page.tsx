import Link from "next/link";
import { CalendarGrid } from "@/components/calendar-grid";
import { buttonClass, PageHeader } from "@/components/ui";
import { dashboardBusiness } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { addDays, dayRange, formatDayLabel, formatPrice, startOfWeek, todayIn } from "@/lib/format";
import { isIsoDate } from "@/lib/time";

export default async function CalendarPage({ searchParams }: PageProps<"/dashboard/calendar">) {
  const params = await searchParams;
  const business = await dashboardBusiness();
  const today = todayIn(business.timezone);
  const date = typeof params.date === "string" && isIsoDate(params.date) ? params.date : today;
  const view = params.view === "week" ? "week" : "day";

  const firstDay = view === "week" ? startOfWeek(date) : date;
  const days = Array.from({ length: view === "week" ? 7 : 1 }, (_, i) => addDays(firstDay, i));
  const { from, to } = dayRange(firstDay, days.length, business.timezone);

  const [appointments, workingHours] = await Promise.all([
    prisma.appointment.findMany({
      where: { businessId: business.id, startsAt: { lt: to }, endsAt: { gt: from } },
      include: { service: true, client: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.workingHours.findMany({ where: { businessId: business.id }, orderBy: { startTime: "asc" } }),
  ]);

  const hoursByWeekday = new Map<number, typeof workingHours>();
  for (const h of workingHours) hoursByWeekday.set(h.weekday, [...(hoursByWeekday.get(h.weekday) ?? []), h]);

  const active = appointments.filter((a) => a.status === "BOOKED" || a.status === "COMPLETED");
  const revenue = active.reduce((sum, a) => sum + a.service.priceCents, 0);
  const step = view === "week" ? 7 : 1;
  const href = (d: string, v = view) => `/dashboard/calendar?view=${v}&date=${d}`;
  const title =
    view === "week"
      ? `${formatDayLabel(days[0], { day: "numeric", month: "short" })} – ${formatDayLabel(days[6], { day: "numeric", month: "short", year: "numeric" })}`
      : formatDayLabel(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <PageHeader
        title={title}
        subtitle={`${active.length} appointment${active.length === 1 ? "" : "s"} · ${formatPrice(revenue)} expected`}
        actions={
          <Link href={`/dashboard/appointments/new?date=${date}`} className={buttonClass.primary}>
            New appointment
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <Link href={href(addDays(date, -step))} className={buttonClass.secondary} aria-label="Previous">
            ←
          </Link>
          <Link href={href(today)} className={buttonClass.secondary}>
            Today
          </Link>
          <Link href={href(addDays(date, step))} className={buttonClass.secondary} aria-label="Next">
            →
          </Link>
        </div>
        <div className="flex rounded-md border border-stone-300 bg-white p-0.5 text-sm">
          {(["day", "week"] as const).map((v) => (
            <Link
              key={v}
              href={href(date, v)}
              aria-current={v === view ? "page" : undefined}
              className={`rounded px-3 py-1.5 capitalize ${v === view ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"}`}
            >
              {v}
            </Link>
          ))}
        </div>
      </div>

      <CalendarGrid
        days={days}
        appointments={appointments}
        hoursByWeekday={hoursByWeekday}
        timezone={business.timezone}
        today={today}
      />
    </>
  );
}
