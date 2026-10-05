import Link from "next/link";
import { notFound } from "next/navigation";
import { updateClient } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/action-form";
import { buttonClass, Card, Field, Input, PageHeader, StatusBadge, Textarea } from "@/components/ui";
import { dashboardBusiness } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { formatDateTime, formatPrice, STATUS_LABELS } from "@/lib/format";

export default async function ClientPage({ params }: PageProps<"/dashboard/clients/[id]">) {
  const { id } = await params;
  const business = await dashboardBusiness();
  const client = await prisma.client.findFirst({
    where: { id, businessId: business.id },
    include: { appointments: { include: { service: true }, orderBy: { startsAt: "desc" } } },
  });
  if (!client) notFound();

  const completed = client.appointments.filter((a) => a.status === "COMPLETED");
  const spent = completed.reduce((sum, a) => sum + a.service.priceCents, 0);
  const noShows = client.appointments.filter((a) => a.status === "NO_SHOW").length;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={client.name}
        subtitle={`${completed.length} completed visit${completed.length === 1 ? "" : "s"} · ${formatPrice(spent)} spent${noShows ? ` · ${noShows} no-show${noShows === 1 ? "" : "s"}` : ""}`}
        actions={
          <>
            <Link href={`/dashboard/appointments/new?clientId=${client.id}`} className={buttonClass.primary}>
              Book appointment
            </Link>
            <Link href="/dashboard/clients" className={buttonClass.secondary}>
              All clients
            </Link>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card title="Appointment history">
          {client.appointments.length ? (
            <ul className="-my-2 divide-y divide-stone-200">
              {client.appointments.map((a) => (
                <li key={a.id}>
                  <Link href={`/dashboard/appointments/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 hover:underline">
                    <span className="text-sm">
                      <span className="font-medium">{a.service.name}</span> · {formatDateTime(a.startsAt, business.timezone)}
                    </span>
                    <StatusBadge status={a.status} label={STATUS_LABELS[a.status] ?? a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">No appointments yet.</p>
          )}
        </Card>

        <Card title="Details">
          <ActionForm action={updateClient}>
            <input type="hidden" name="id" value={client.id} />
            <Field label="Name">
              <Input name="name" defaultValue={client.name} required />
            </Field>
            <Field label="Phone">
              <Input name="phone" type="tel" defaultValue={client.phone ?? ""} />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={client.email ?? ""} />
            </Field>
            <Field label="Notes">
              <Textarea name="notes" defaultValue={client.notes ?? ""} />
            </Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
