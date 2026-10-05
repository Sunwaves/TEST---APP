import Link from "next/link";
import { createClient } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/action-form";
import { buttonClass, Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { dashboardBusiness } from "@/lib/dashboard";
import { clientSearch } from "@/lib/clients";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export default async function ClientsPage({ searchParams }: PageProps<"/dashboard/clients">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const business = await dashboardBusiness();
  const clients = await prisma.client.findMany({
    where: {
      businessId: business.id,
      ...clientSearch(q),
    },
    include: {
      appointments: { where: { status: { in: ["BOOKED", "COMPLETED"] } }, orderBy: { startsAt: "desc" }, take: 1 },
      _count: { select: { appointments: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Clients" subtitle={`${clients.length} ${q ? "matching" : "in total"}`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <form className="flex gap-2" role="search">
            <Input name="q" type="search" defaultValue={q} placeholder="Search name, phone or email" aria-label="Search clients" />
            <button className={buttonClass.secondary}>Search</button>
          </form>
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xs">
            {clients.length ? (
              <ul className="divide-y divide-stone-200">
                {clients.map((c) => (
                  <li key={c.id}>
                    <Link href={`/dashboard/clients/${c.id}`} className="flex flex-col gap-0.5 px-4 py-3 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        <span className="font-medium">{c.name}</span>
                        <span className="block text-sm text-stone-500">{[c.phone, c.email].filter(Boolean).join(" · ") || "No contact details"}</span>
                      </span>
                      <span className="text-sm text-stone-500">
                        {c._count.appointments} visit{c._count.appointments === 1 ? "" : "s"}
                        {c.appointments[0] && ` · last ${formatDateTime(c.appointments[0].startsAt, business.timezone)}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-sm text-stone-500">No clients found.</p>
            )}
          </div>
        </div>

        <Card title="Add client">
          <ActionForm action={createClient} submitLabel="Add client" resetOnSuccess>
            <Field label="Name">
              <Input name="name" required />
            </Field>
            <Field label="Phone">
              <Input name="phone" type="tel" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" />
            </Field>
            <Field label="Notes">
              <Textarea name="notes" />
            </Field>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
