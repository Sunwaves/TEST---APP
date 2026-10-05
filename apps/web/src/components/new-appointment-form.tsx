"use client";

import { useActionState, useEffect, useState } from "react";
import { createAppointment } from "@/app/dashboard/actions";
import { formatDuration, formatPrice } from "@/lib/format";
import { buttonClass, Field, Input, Select, Textarea } from "./ui";

interface ServiceOption {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
}

interface ClientOption {
  id: string;
  name: string;
  phone: string | null;
}

// Result of the last availability request, tagged with the service/date it was for.
type SlotsResult = { key: string } & ({ status: "error" } | { status: "ready"; times: string[] });

export function NewAppointmentForm({
  services,
  clients,
  defaultDate,
  defaultTime,
  defaultClientId,
}: {
  services: ServiceOption[];
  clients: ClientOption[];
  defaultDate: string;
  defaultTime?: string;
  defaultClientId?: string;
}) {
  const [state, formAction, pending] = useActionState(createAppointment, {});
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime ?? "");
  const [clientId, setClientId] = useState(defaultClientId ?? (clients.length ? "" : "new"));
  const [result, setResult] = useState<SlotsResult | null>(null);

  // Suggest free times for the chosen service and day.
  const key = `${serviceId}|${date}`;
  useEffect(() => {
    if (!serviceId || !date) return;
    const controller = new AbortController();
    fetch(`/api/availability?serviceId=${encodeURIComponent(serviceId)}&date=${date}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { slots: { time: string }[] }) =>
        setResult({ key: `${serviceId}|${date}`, status: "ready", times: data.slots.map((s) => s.time) }),
      )
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key: `${serviceId}|${date}`, status: "error" });
      });
    return () => controller.abort();
  }, [serviceId, date]);
  const slots = !serviceId || !date ? { status: "idle" as const } : result?.key === key ? result : { status: "loading" as const };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field label="Service">
        <Select name="serviceId" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {formatDuration(s.durationMinutes)} · {formatPrice(s.priceCents)}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date">
          <Input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Time" hint="Pick a free slot below, or type any time.">
          <Input type="time" name="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-stone-700">Free slots</p>
        {slots.status === "loading" && <p className="text-sm text-stone-500">Checking availability…</p>}
        {slots.status === "error" && <p className="text-sm text-red-700">Couldn&apos;t load free slots.</p>}
        {slots.status === "ready" &&
          (slots.times.length ? (
            <div className="flex flex-wrap gap-2">
              {slots.times.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  aria-pressed={t === time}
                  className={`rounded-md border px-2.5 py-1 text-sm ${
                    t === time ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white hover:bg-stone-100"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-500">No free slots in opening hours that day. You can still type a time.</p>
          ))}
      </div>

      <Field label="Client">
        <Select name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
          <option value="" disabled>
            Choose a client…
          </option>
          <option value="new">+ New client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.phone ? ` · ${c.phone}` : ""}
            </option>
          ))}
        </Select>
      </Field>

      {clientId === "new" && (
        <div className="grid gap-4 rounded-md border border-dashed border-stone-300 p-4 sm:grid-cols-3">
          <Field label="Name">
            <Input name="clientName" required autoComplete="off" />
          </Field>
          <Field label="Phone">
            <Input name="clientPhone" type="tel" autoComplete="off" />
          </Field>
          <Field label="Email">
            <Input name="clientEmail" type="email" autoComplete="off" />
          </Field>
        </div>
      )}

      <Field label="Notes">
        <Textarea name="notes" placeholder="Anything to remember for this visit" />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Booking…" : "Book appointment"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-red-700">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
