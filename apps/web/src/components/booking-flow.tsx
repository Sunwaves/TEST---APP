"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createOnlineBooking } from "@/app/book/actions";
import { addDays, formatDayLabel, formatDuration, formatPrice } from "@/lib/format";
import { submitKeepingValues } from "./action-form";
import { buttonClass, Field, Input, Textarea } from "./ui";

type Service = BookableService;

type Slot = { startsAt: string; time: string };
type SlotsResult = { key: string } & ({ status: "error" } | { status: "ready"; slots: Slot[] });

const DAYS_SHOWN = 7;

export interface BookableService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
}

export function BookingFlow({
  slug,
  services,
  openWeekdays,
  window,
  initialService,
  onExit,
}: {
  slug: string;
  services: Service[];
  openWeekdays: number[];
  window: { first: string; last: string };
  /** Start at "pick a time" for this service (chosen on the salon page). */
  initialService?: Service;
  /** Where "Back" goes from the first step shown; defaults to the service list. */
  onExit?: () => void;
}) {
  const [service, setService] = useState<Service | null>(initialService ?? null);
  const [weekStart, setWeekStart] = useState(window.first);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [step, setStep] = useState<"service" | "time" | "details">(initialService ? "time" : "service");
  const [result, setResult] = useState<SlotsResult | null>(null);
  const [state, formAction, pending] = useActionState(createOnlineBooking.bind(null, slug), {});

  const isOpen = (d: string) => d >= window.first && d <= window.last && openWeekdays.includes(new Date(`${d}T00:00:00Z`).getUTCDay());
  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const firstOpenDay = useMemo(() => {
    for (let d = window.first; d <= window.last; d = addDays(d, 1)) if (isOpen(d)) return d;
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window.first, window.last]);
  const selectedDate = date ?? firstOpenDay;

  const key = `${service?.id}|${selectedDate}`;
  useEffect(() => {
    if (!service || !selectedDate) return;
    const controller = new AbortController();
    const k = `${service.id}|${selectedDate}`;
    fetch(`/api/public/${slug}/availability?serviceId=${encodeURIComponent(service.id)}&date=${selectedDate}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { slots: Slot[] }) => setResult({ key: k, status: "ready", slots: data.slots }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key: k, status: "error" });
      });
    return () => controller.abort();
  }, [slug, service, selectedDate]);
  const slots = result?.key === key ? result : { status: "loading" as const };

  if (step === "service" || !service) {
    return (
      <Step title="Choose a service" number={1}>
        <ul className="flex flex-col gap-3">
          {services.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setService(s);
                  setSlot(null);
                  setStep("time");
                }}
                className="flex w-full items-center justify-between gap-4 rounded-lg border border-stone-200 bg-white p-4 text-left shadow-xs transition hover:border-amber-400 hover:shadow-sm"
              >
                <span>
                  <span className="block font-medium">{s.name}</span>
                  {s.description && <span className="block text-sm text-stone-600">{s.description}</span>}
                  <span className="mt-1 block text-sm text-stone-500">{formatDuration(s.durationMinutes)}</span>
                </span>
                <span className="shrink-0 font-semibold">{formatPrice(s.priceCents)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Step>
    );
  }

  if (step === "time" || !slot || !selectedDate) {
    return (
      <Step title="Pick a time" number={2} onBack={() => (onExit ? onExit() : setStep("service"))} summary={`${service.name} · ${formatDuration(service.durationMinutes)}`}>
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            className={`${buttonClass.secondary} px-3 py-1.5`}
            disabled={weekStart <= window.first}
            onClick={() => setWeekStart((w) => (addDays(w, -DAYS_SHOWN) < window.first ? window.first : addDays(w, -DAYS_SHOWN)))}
            aria-label="Earlier days"
          >
            ←
          </button>
          <span className="text-sm font-medium">{formatDayLabel(days[0], { month: "long", year: "numeric" })}</span>
          <button
            type="button"
            className={`${buttonClass.secondary} px-3 py-1.5`}
            disabled={addDays(weekStart, DAYS_SHOWN) > window.last}
            onClick={() => setWeekStart((w) => addDays(w, DAYS_SHOWN))}
            aria-label="Later days"
          >
            →
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const open = isOpen(d);
            const selected = d === selectedDate;
            return (
              <button
                key={d}
                type="button"
                disabled={!open}
                onClick={() => {
                  setDate(d);
                  setSlot(null);
                }}
                aria-pressed={selected}
                aria-label={formatDayLabel(d, { weekday: "long", day: "numeric", month: "long" })}
                className={`flex flex-col items-center rounded-lg border py-2 text-sm ${
                  selected
                    ? "border-stone-900 bg-stone-900 text-white"
                    : open
                      ? "border-stone-200 bg-white hover:border-amber-400"
                      : "cursor-not-allowed border-transparent text-stone-300"
                }`}
              >
                <span className="text-xs uppercase">{formatDayLabel(d, { weekday: "short" })}</span>
                <span className="text-base font-semibold">{formatDayLabel(d, { day: "numeric" })}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {!selectedDate ? (
            <p className="text-sm text-stone-600">No days are open for online booking right now.</p>
          ) : !isOpen(selectedDate) ? (
            <p className="text-sm text-stone-600">Closed that day. Pick another day.</p>
          ) : slots.status === "loading" ? (
            <p className="text-sm text-stone-500">Finding free times…</p>
          ) : slots.status === "error" ? (
            <p className="text-sm text-red-700">Couldn&apos;t load times. Please try again.</p>
          ) : slots.slots.length ? (
            <>
              <p className="mb-2 text-sm font-medium">{formatDayLabel(selectedDate, { weekday: "long", day: "numeric", month: "long" })}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {slots.slots.map((s) => (
                  <button
                    key={s.startsAt}
                    type="button"
                    onClick={() => {
                      setDate(selectedDate);
                      setSlot(s);
                      setStep("details");
                    }}
                    className="rounded-lg border border-stone-200 bg-white py-2 text-sm font-medium hover:border-amber-400 hover:bg-amber-50"
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-stone-600">Fully booked that day. Try another day.</p>
          )}
        </div>
      </Step>
    );
  }

  return (
    <Step
      title="Your details"
      number={3}
      onBack={() => setStep("time")}
      summary={`${service.name} · ${formatDayLabel(selectedDate, { weekday: "long", day: "numeric", month: "long" })} at ${slot.time} · ${formatPrice(service.priceCents)}`}
    >
      <form onSubmit={submitKeepingValues(formAction)} className="flex flex-col gap-4">
        <input type="hidden" name="serviceId" value={service.id} />
        <input type="hidden" name="startsAt" value={slot.startsAt} />
        {/* Spam trap: bots fill every input, people never see this one. It is display:none
            and has a meaningless name so browser autofill leaves it alone. */}
        <input type="text" name="hp_extra" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <Field label="Name">
          <Input name="name" autoComplete="name" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" />
          </Field>
          <Field label="Phone">
            <Input name="phone" type="tel" autoComplete="tel" />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-stone-500">Email or phone, so the salon can reach you about your booking.</p>
        <Field label="Anything we should know? (optional)">
          <Textarea name="notes" rows={2} />
        </Field>
        {state.error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className={`${buttonClass.primary} py-3 text-base`}>
          {pending ? "Booking…" : "Confirm booking"}
        </button>
      </form>
    </Step>
  );
}

function Step({
  number,
  title,
  summary,
  onBack,
  children,
}: {
  number: number;
  title: string;
  summary?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-amber-700 uppercase">Step {number} of 3</p>
          <h2 className="text-xl font-semibold">{title}</h2>
          {summary && <p className="mt-1 text-sm text-stone-600">{summary}</p>}
        </div>
        {onBack && (
          <button type="button" onClick={onBack} className="shrink-0 text-sm text-stone-600 underline hover:text-stone-900">
            Back
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
