import Link from "next/link";
import { RevenueChart } from "@/components/revenue-chart";
import { buttonClass, Card, inputClass, PageHeader } from "@/components/ui";
import { dashboardBusiness } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { addDays, dayRange, formatDayLabel, formatPrice, todayIn } from "@/lib/format";
import { buildReport } from "@/lib/reports";
import { isIsoDate } from "@/lib/time";

// The shared input style is full-width; the range picker needs compact inputs side by side.
const dateInput = `${inputClass.replace("w-full", "")} w-[9.5rem]`;

function presets(today: string) {
  const monthStart = `${today.slice(0, 8)}01`;
  return [
    { label: "Last 7 days", from: addDays(today, -6), to: today },
    { label: "Last 30 days", from: addDays(today, -29), to: today },
    { label: "This month", from: monthStart, to: today },
    { label: "Last 90 days", from: addDays(today, -89), to: today },
  ];
}

export default async function ReportsPage({ searchParams }: PageProps<"/dashboard/reports">) {
  const business = await dashboardBusiness();
  const params = await searchParams;
  const today = todayIn(business.timezone);
  let from = typeof params.from === "string" && isIsoDate(params.from) ? params.from : addDays(today, -29);
  let to = typeof params.to === "string" && isIsoDate(params.to) ? params.to : today;
  if (from > to) [from, to] = [to, from];
  if (addDays(from, 366) < to) from = addDays(to, -366);

  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const { from: start, to: end } = dayRange(from, days, business.timezone);
  const appointments = await prisma.appointment.findMany({
    where: { businessId: business.id, startsAt: { gte: start, lt: end } },
    select: {
      startsAt: true,
      status: true,
      source: true,
      clientId: true,
      client: { select: { name: true } },
      service: { select: { id: true, name: true, priceCents: true } },
    },
  });
  const firsts = await prisma.appointment.groupBy({
    by: ["clientId"],
    where: { businessId: business.id, status: { not: "CANCELLED" }, clientId: { in: [...new Set(appointments.map((a) => a.clientId))] } },
    _min: { startsAt: true },
  });
  const report = buildReport(
    appointments,
    new Map(firsts.map((f) => [f.clientId, f._min.startsAt!])),
    from,
    to,
    business.timezone,
  );

  const total = appointments.length;
  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : "—");
  const tiles = [
    { label: "Revenue", value: formatPrice(report.revenueCents), note: `from ${report.byStatus.COMPLETED} completed` },
    { label: "Still booked", value: formatPrice(report.expectedCents), note: `${report.byStatus.BOOKED} upcoming or not yet closed` },
    {
      label: "No-show rate",
      value: report.noShowRate === null ? "—" : `${Math.round(report.noShowRate * 100)}%`,
      note: `${report.byStatus.NO_SHOW} no-show${report.byStatus.NO_SHOW === 1 ? "" : "s"}`,
    },
    { label: "Clients seen", value: String(report.newClients + report.returningClients), note: `${report.newClients} new · ${report.returningClients} returning` },
  ];
  const topServiceMax = Math.max(1, ...report.topServices.map((s) => s.revenueCents));
  const rangeLabel = `${formatDayLabel(from, { day: "numeric", month: "short", year: "numeric" })} – ${formatDayLabel(to, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      <PageHeader title="Reports" subtitle={rangeLabel} />

      {/* Filters: presets + custom range, in one row */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1">
          {presets(today).map((p) => {
            const current = p.from === from && p.to === to;
            return (
              <Link
                key={p.label}
                href={`/dashboard/reports?from=${p.from}&to=${p.to}`}
                aria-current={current ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm ${current ? "bg-stone-900 text-white" : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"}`}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <input type="date" name="from" defaultValue={from} aria-label="From" className={dateInput} />
          <span className="text-stone-500">to</span>
          <input type="date" name="to" defaultValue={to} aria-label="To" className={dateInput} />
          <button className={`${buttonClass.secondary} py-2`}>Apply</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-stone-200 bg-white p-4 shadow-xs">
            <p className="text-sm text-stone-600">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{t.value}</p>
            <p className="mt-1 text-xs text-stone-500">{t.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Card title={`Revenue per ${report.bucketSize}`}>
            <RevenueChart buckets={report.buckets} />
          </Card>
        </div>

        <Card title="Appointments">
          <dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 text-sm">
            {(
              [
                ["Completed", report.byStatus.COMPLETED],
                ["Booked", report.byStatus.BOOKED],
                ["Cancelled", report.byStatus.CANCELLED],
                ["No-show", report.byStatus.NO_SHOW],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="contents">
                <dt className="text-stone-600">{label}</dt>
                <dd className="text-right font-medium tabular-nums">{n}</dd>
                <dd className="text-right text-stone-500 tabular-nums">{pct(n)}</dd>
              </div>
            ))}
            <div className="col-span-3 my-1 border-t border-stone-200" />
            <dt className="text-stone-600">Booked online</dt>
            <dd className="text-right font-medium tabular-nums">{report.online}</dd>
            <dd className="text-right text-stone-500 tabular-nums">{pct(report.online)}</dd>
            <dt className="text-stone-600">Booked by staff</dt>
            <dd className="text-right font-medium tabular-nums">{report.staff}</dd>
            <dd className="text-right text-stone-500 tabular-nums">{pct(report.staff)}</dd>
          </dl>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Top services">
          {report.topServices.length ? (
            <ul className="flex flex-col gap-3">
              {report.topServices.map((s) => (
                <li key={s.id} title={`${s.name}: ${formatPrice(s.revenueCents)} from ${s.count} completed`}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{s.name}</span>
                    <span className="text-stone-500">{s.count} completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="block h-5 rounded-r-[4px]" style={{ width: `${(s.revenueCents / topServiceMax) * 80}%`, background: "#d97706" }} />
                    <span className="text-sm font-medium tabular-nums">{formatPrice(s.revenueCents)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">No completed appointments in this period.</p>
          )}
        </Card>

        <Card title="Top clients">
          {report.topClients.length ? (
            <table className="w-full text-left text-sm">
              <thead className="text-stone-500">
                <tr>
                  <th className="pb-2 font-medium">Client</th>
                  <th className="pb-2 text-right font-medium">Visits</th>
                  <th className="pb-2 text-right font-medium">Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {report.topClients.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2">
                      <Link href={`/dashboard/clients/${c.id}`} className="underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-2 text-right tabular-nums">{c.visits}</td>
                    <td className="py-2 text-right tabular-nums">{formatPrice(c.spentCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-stone-500">No completed appointments in this period.</p>
          )}
        </Card>
      </div>
    </>
  );
}
