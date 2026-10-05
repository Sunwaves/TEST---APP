"use client";

import { useState } from "react";
import { saveWorkingHours } from "@/app/dashboard/actions";
import { ActionForm } from "./action-form";
import { buttonClass, Input } from "./ui";

type Window = { startTime: string; endTime: string };

// Monday first, as salons usually think of the week.
const DAYS = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [0, "Sunday"],
] as const;

export function HoursEditor({ initial }: { initial: ({ weekday: number } & Window)[] }) {
  const [hours, setHours] = useState<Record<number, Window[]>>(() => {
    const byDay: Record<number, Window[]> = {};
    for (const h of initial) (byDay[h.weekday] ??= []).push({ startTime: h.startTime, endTime: h.endTime });
    return byDay;
  });

  const update = (day: number, windows: Window[]) => setHours((prev) => ({ ...prev, [day]: windows }));

  return (
    <ActionForm action={saveWorkingHours} submitLabel="Save opening hours">
      <div className="divide-y divide-stone-200">
        {DAYS.map(([day, name]) => {
          const windows = hours[day] ?? [];
          return (
            <div key={day} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
              <div className="w-28 shrink-0 pt-2 text-sm font-medium">{name}</div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {windows.length === 0 && <p className="pt-2 text-sm text-stone-500">Closed</p>}
                {windows.map((w, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="hidden" name="weekday" value={day} />
                    <Input
                      type="time"
                      name="startTime"
                      aria-label={`${name} opens`}
                      value={w.startTime}
                      onChange={(e) => update(day, windows.map((x, j) => (j === i ? { ...x, startTime: e.target.value } : x)))}
                      className="min-w-0 max-w-32 flex-1"
                      required
                    />
                    <span className="text-stone-500">to</span>
                    <Input
                      type="time"
                      name="endTime"
                      aria-label={`${name} closes`}
                      value={w.endTime}
                      onChange={(e) => update(day, windows.map((x, j) => (j === i ? { ...x, endTime: e.target.value } : x)))}
                      className="min-w-0 max-w-32 flex-1"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => update(day, windows.filter((_, j) => j !== i))}
                      className="shrink-0 rounded px-1.5 py-1 text-sm text-stone-500 hover:bg-stone-100 hover:text-red-700"
                      aria-label={`Remove ${name} ${w.startTime}–${w.endTime}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  const last = windows.at(-1);
                  update(day, [...windows, last ? { startTime: last.endTime, endTime: "18:00" } : { startTime: "09:00", endTime: "17:00" }]);
                }}
                className={`${buttonClass.secondary} self-start px-3 py-1.5`}
              >
                {windows.length ? "Add break / shift" : "Open this day"}
              </button>
            </div>
          );
        })}
      </div>
    </ActionForm>
  );
}
