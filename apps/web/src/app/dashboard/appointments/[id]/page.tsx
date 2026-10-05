import Link from "next/link";
import { notFound } from "next/navigation";
import { rescheduleAppointment, saveAppointmentNotes, setAppointmentStatus } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/action-form";
import { buttonClass, Card, Field, Input, PageHeader, StatusBadge, Textarea } from "@/components/ui";
import { dashboardBusiness } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { formatDateTime, formatDuration, formatPrice, STATUS_LABELS } from "@/lib/format";
import { toZonedHHMM, toZonedIsoDate } from "@/lib/time";

const STATUS_ACTIONS: Record<string, { status: string; label: string; variant: "primary" | "secondary" | "danger" }[]> = {
  BOOKED: [
    { status: "COMPLETED", label: "Mark completed", variant: "primary" },
    { status: "NO_SHOW", label: "Mark no-show", variant: "secondary" },
    { status: "CANCELLED", label: "Cancel appointment", variant: "danger" },
  ],
  COMPLETED: [{ status: "BOOKED", label: "Undo completed", variant: "secondary" }],
  CANCELLED: [{ status: "BOOKED", label: "Restore booking", variant: "secondary" }],
  NO_SHOW: [{ status: "BOOKED", label: "Undo no-show", variant: "secondary" }],
};

export default async function AppointmentPage({ params }: PageProps<"/dashboard/appointments/[id]">) {
  const { id } = await params;
  const business = await dashboardBusiness();
  const appointment = await prisma.appointment.findFirst({
    where: { id, businessId: business.id },
    include: { service: true, client: true },
  });
  if (!appointment) notFound();

  const tz = business.timezone;
  const date = toZonedIsoDate(appointment.startsAt, tz);
  const details: [string, React.ReactNode][] = [
    ["When", formatDateTime(appointment.startsAt, tz)],
    ["Service", `${appointment.service.name} · ${formatDuration(appointment.service.durationMinutes)}`],
    ["Price", formatPrice(appointment.service.priceCents)],
    [
      "Client",
      <Link key="c" href={`/dashboard/clients/${appointment.client.id}`} className="underline">
        {appointment.client.name}
      </Link>,
    ],
    ["Phone", appointment.client.phone ?? "—"],
    ["Booked", appointment.source === "ONLINE" ? "Online" : "By staff"],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`${appointment.client.name} · ${appointment.service.name}`}
        subtitle={<StatusBadge status={appointment.status} label={STATUS_LABELS[appointment.status] ?? appointment.status} />}
        actions={
          <Link href={`/dashboard/calendar?date=${date}`} className={buttonClass.secondary}>
            Back to calendar
          </Link>
        }
      />

      <div className="grid gap-4">
        <Card title="Details">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
            {details.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-stone-500">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Status">
          <div className="flex flex-wrap gap-3">
            {(STATUS_ACTIONS[appointment.status] ?? []).map((a) => (
              <ActionForm key={a.status} action={setAppointmentStatus} submitLabel={a.label} variant={a.variant} className="flex">
                <input type="hidden" name="id" value={appointment.id} />
                <input type="hidden" name="status" value={a.status} />
              </ActionForm>
            ))}
          </div>
        </Card>

        {appointment.status === "BOOKED" && (
          <Card title="Reschedule">
            <ActionForm action={rescheduleAppointment} submitLabel="Move appointment" variant="secondary">
              <input type="hidden" name="id" value={appointment.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New date">
                  <Input type="date" name="date" defaultValue={date} required />
                </Field>
                <Field label="New time">
                  <Input type="time" name="time" step={300} defaultValue={toZonedHHMM(appointment.startsAt, tz)} required />
                </Field>
              </div>
            </ActionForm>
          </Card>
        )}

        <Card title="Notes">
          <ActionForm action={saveAppointmentNotes} submitLabel="Save notes" variant="secondary">
            <input type="hidden" name="id" value={appointment.id} />
            <Textarea name="notes" defaultValue={appointment.notes ?? ""} placeholder="Formula, preferences, follow-ups…" />
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
