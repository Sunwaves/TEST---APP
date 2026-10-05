"use client";

import { useRef, useState } from "react";
import { formatDuration, formatPrice } from "@/lib/format";
import { BookingFlow, type BookableService } from "./booking-flow";

// The services list on a salon page. Choosing one swaps the list for the booking steps.

export function SalonBooking({
  slug,
  services,
  openWeekdays,
  window,
}: {
  slug: string;
  services: BookableService[];
  openWeekdays: number[];
  window: { first: string; last: string };
}) {
  const [chosen, setChosen] = useState<BookableService | null>(null);
  const top = useRef<HTMLElement>(null);
  const scrollUp = () => requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

  return (
    <section id="services" ref={top} className="scroll-mt-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
      {chosen ? (
        <BookingFlow
          key={chosen.id}
          slug={slug}
          services={services}
          openWeekdays={openWeekdays}
          window={window}
          initialService={chosen}
          onExit={() => {
            setChosen(null);
            scrollUp();
          }}
        />
      ) : (
        <>
          <h2 className="mb-1 text-lg font-semibold">Services</h2>
          <p className="mb-4 text-sm text-stone-600">Choose a service to see free times.</p>
          {services.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {services.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(s);
                      scrollUp();
                    }}
                    className="group flex h-full w-full flex-col rounded-xl border border-stone-200 bg-white p-4 text-left transition hover:border-amber-400 hover:shadow-md focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-medium">{s.name}</span>
                      <span className="shrink-0 font-semibold">{formatPrice(s.priceCents)}</span>
                    </span>
                    {s.description && <span className="mt-1 text-sm text-stone-600">{s.description}</span>}
                    <span className="mt-auto flex items-center justify-between pt-3 text-sm">
                      <span className="text-stone-500">{formatDuration(s.durationMinutes)}</span>
                      <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-white group-hover:bg-amber-600">Book</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-600">Online booking isn&apos;t available yet. Please contact the salon.</p>
          )}
        </>
      )}
    </section>
  );
}
