import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { dashboardBusiness } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { deliveryMode } from "@/lib/messages/drivers";

const KIND_LABELS: Record<string, string> = {
  CONFIRMATION: "Confirmation",
  REMINDER: "Reminder",
  CANCELLATION: "Cancellation",
  RESCHEDULE: "Rescheduled",
  NEW_BOOKING_ALERT: "New booking alert",
  CANCELLATION_ALERT: "Cancellation alert",
  PASSWORD_RESET: "Password reset",
  LIMIT_ALERT: "Booking limit alert",
};

const STATUS: Record<string, { label: string; className: string }> = {
  QUEUED: { label: "Scheduled", className: "bg-sky-100 text-sky-900" },
  SENDING: { label: "Sending", className: "bg-sky-100 text-sky-900" },
  SENT: { label: "Sent", className: "bg-emerald-100 text-emerald-900" },
  FAILED: { label: "Failed", className: "bg-red-100 text-red-800" },
  SKIPPED: { label: "Not sent", className: "bg-stone-200 text-stone-600" },
};

const FILTERS = [
  ["", "All"],
  ["QUEUED", "Scheduled"],
  ["SENT", "Sent"],
  ["FAILED", "Failed"],
  ["SKIPPED", "Not sent"],
] as const;

export default async function MessagesPage({ searchParams }: PageProps<"/dashboard/messages">) {
  const business = await dashboardBusiness();
  const status = (await searchParams).status;
  const filter = typeof status === "string" && status in STATUS ? status : "";
  const messages = await prisma.message.findMany({
    where: { businessId: business.id, ...(filter ? { status: filter } : {}) },
    orderBy: [{ sendAt: "desc" }],
    take: 200,
  });
  const simulated = (["EMAIL", "SMS"] as const).filter((c) => deliveryMode(c) === "simulated");

  return (
    <>
      <PageHeader title="Messages" subtitle="Confirmations, reminders and alerts sent to clients and to you." />

      {simulated.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Test mode:</strong> {simulated.map((c) => (c === "EMAIL" ? "email" : "SMS")).join(" and ")} {simulated.length > 1 ? "are" : "is"}{" "}
          simulated. Messages are recorded here exactly as they would be sent, but nothing leaves the app until a provider is connected.
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/dashboard/messages?status=${value}` : "/dashboard/messages"}
            aria-current={value === filter ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm ${value === filter ? "bg-stone-900 text-white" : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <Card>
        {messages.length ? (
          <ul className="-my-3 divide-y divide-stone-200">
            {messages.map((m) => {
              const s = STATUS[m.status] ?? STATUS.QUEUED;
              return (
                <li key={m.id} className="py-3">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="min-w-0">
                        <span className="font-medium">{KIND_LABELS[m.kind] ?? m.kind}</span>
                        <span className="text-stone-500"> · {m.channel === "EMAIL" ? "Email" : "SMS"} to </span>
                        <span className="break-all">{m.recipient}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-sm text-stone-500">
                        {m.status === "QUEUED" ? "Sends" : ""} {formatDateTime(m.sentAt ?? m.sendAt, business.timezone)}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>
                      </span>
                    </summary>
                    <div className="mt-3 rounded-md bg-stone-50 p-3 text-sm">
                      {m.subject && <p className="mb-2 font-medium">{m.subject}</p>}
                      <p className="whitespace-pre-line text-stone-700">{m.body}</p>
                      {m.error && <p className="mt-2 text-xs text-red-700">{m.error}</p>}
                      {m.appointmentId && (
                        <Link href={`/dashboard/appointments/${m.appointmentId}`} className="mt-2 inline-block text-xs underline">
                          Open appointment
                        </Link>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-stone-500">No messages yet. They appear here when appointments are booked, moved or cancelled.</p>
        )}
      </Card>
    </>
  );
}
