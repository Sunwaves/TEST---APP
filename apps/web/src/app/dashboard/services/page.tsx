import Link from "next/link";
import { createService } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { dashboardBusiness } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { formatDuration, formatPrice } from "@/lib/format";
import { ServiceFields } from "./fields";

export default async function ServicesPage() {
  const business = await dashboardBusiness();
  const services = await prisma.service.findMany({
    where: { businessId: business.id },
    include: { _count: { select: { appointments: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader title="Services" subtitle="What clients can book, how long it takes and what it costs." />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xs">
          {services.length ? (
            <ul className="divide-y divide-stone-200">
              {services.map((s) => (
                <li key={s.id}>
                  <Link href={`/dashboard/services/${s.id}`} className={`flex items-center justify-between gap-4 px-4 py-3 hover:bg-stone-50 ${s.active ? "" : "opacity-60"}`}>
                    <span>
                      <span className="font-medium">{s.name}</span>
                      {!s.active && <span className="ml-2 text-xs text-stone-500">(hidden)</span>}
                      <span className="block text-sm text-stone-500">
                        {formatDuration(s.durationMinutes)}
                        {s.bufferMinutes ? ` + ${s.bufferMinutes} min buffer` : ""} · {s._count.appointments} booked
                      </span>
                    </span>
                    <span className="font-medium">{formatPrice(s.priceCents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-stone-500">No services yet.</p>
          )}
        </div>

        <Card title="Add service">
          <ActionForm action={createService} submitLabel="Add service" resetOnSuccess>
            <ServiceFields />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
