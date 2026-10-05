"use client";

import { useState } from "react";
import type { Bucket } from "@/lib/reports";
import { formatPrice } from "@/lib/format";

// Single-series column chart: revenue per day/week. One hue (validated amber),
// recessive grid, 4px rounded tops, hover/focus tooltip, and a table view.

const BAR = "#d97706";

/** Rounds up to 1, 2 or 5 × 10^n so gridlines land on tidy amounts. */
function niceMax(value: number): number {
  if (value <= 0) return 100_00;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [1, 2, 5, 10].find((m) => m * exp >= value) ?? 10;
  return step * exp;
}

export function RevenueChart({ buckets }: { buckets: Bucket[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...buckets.map((b) => b.revenueCents)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  // Thin the x labels so they never collide: ~4 on phones, ~8 on wider screens.
  const everyNarrow = Math.ceil(buckets.length / 4);
  const everyWide = Math.ceil(buckets.length / 8);
  const shown = active === null ? null : buckets[active];

  return (
    <div>
      <div className="relative ml-16 h-56">
        {/* Gridlines + y labels */}
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-stone-200" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="absolute -left-16 w-14 -translate-y-1/2 text-right text-xs text-stone-500 tabular-nums">
              {formatPrice(t, { whole: true })}
            </span>
          </div>
        ))}

        {/* Columns */}
        <div className="absolute inset-0 flex items-end gap-0.5">
          {buckets.map((b, i) => (
            <button
              key={b.key}
              type="button"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${b.label}: ${formatPrice(b.revenueCents)}, ${b.completed} completed`}
              className="group flex h-full min-w-0 flex-1 items-end justify-center outline-none"
            >
              <span
                className="block w-full max-w-6 rounded-t-[4px] transition-opacity group-focus-visible:ring-2 group-focus-visible:ring-stone-900"
                style={{
                  height: `${(b.revenueCents / max) * 100}%`,
                  minHeight: b.revenueCents ? 2 : 0,
                  background: BAR,
                  opacity: active === null || active === i ? 1 : 0.45,
                }}
              />
            </button>
          ))}
        </div>

        {shown && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs whitespace-nowrap shadow-md"
            style={{ left: `${Math.min(88, Math.max(12, ((active + 0.5) / buckets.length) * 100))}%` }}
          >
            <p className="font-medium text-stone-900">{shown.label}</p>
            <p className="text-stone-700 tabular-nums">{formatPrice(shown.revenueCents)}</p>
            <p className="text-stone-500">{shown.completed} completed</p>
          </div>
        )}
      </div>

      {/* X labels, thinned so they never collide */}
      <div className="mt-2 ml-16 flex gap-0.5">
        {buckets.map((b, i) => (
          <span key={b.key} className="min-w-0 flex-1 text-center text-[11px] whitespace-nowrap text-stone-500">
            {i % everyNarrow === 0 && <span className="sm:hidden">{b.label.replace("w/c ", "")}</span>}
            {i % everyWide === 0 && <span className="hidden sm:inline">{b.label.replace("w/c ", "")}</span>}
          </span>
        ))}
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-stone-600 underline">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-stone-500">
            <tr>
              <th className="py-1 font-medium">Period</th>
              <th className="py-1 text-right font-medium">Completed</th>
              <th className="py-1 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {buckets.map((b) => (
              <tr key={b.key}>
                <td className="py-1">{b.label}</td>
                <td className="py-1 text-right tabular-nums">{b.completed}</td>
                <td className="py-1 text-right tabular-nums">{formatPrice(b.revenueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
