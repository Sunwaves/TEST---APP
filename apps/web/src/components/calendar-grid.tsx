import Link from "next/link";
import type { Appointment, Client, Service } from "@prisma/client";
import { layoutLanes } from "@/lib/calendar-layout";
import { formatDayLabel } from "@/lib/format";
import { minutesOfDay, toZonedHHMM, toZonedIsoDate } from "@/lib/time";

type Appt = Appointment & { service: Service; client: Client };
type Window = { startTime: string; endTime: string };

const PX_PER_MIN = 1.2;

const blockStyles: Record<string, string> = {
  BOOKED: "border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100",
  COMPLETED: "border-emerald-400 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
  CANCELLED: "border-stone-300 bg-stone-100 text-stone-500 line-through opacity-70",
  NO_SHOW: "border-red-300 bg-red-50 text-red-900 opacity-80",
};

export function CalendarGrid({
  days,
  appointments,
  hoursByWeekday,
  timezone,
  today,
}: {
  days: string[];
  appointments: Appt[];
  hoursByWeekday: Map<number, Window[]>;
  timezone: string;
  today: string;
}) {
  // Each appointment as minutes-of-day on its local calendar date.
  const placed = appointments.map((a) => {
    const date = toZonedIsoDate(a.startsAt, timezone);
    const start = minutesOfDay(toZonedHHMM(a.startsAt, timezone));
    const sameDay = toZonedIsoDate(a.endsAt, timezone) === date;
    const end = sameDay ? Math.max(start + 15, minutesOfDay(toZonedHHMM(a.endsAt, timezone))) : 24 * 60;
    return { appt: a, date, start, end };
  });

  // Visible hours: at least 08:00–19:00, widened to fit opening hours and bookings.
  const allWindows = [...hoursByWeekday.values()].flat();
  const firstMinute = Math.min(8 * 60, ...allWindows.map((w) => minutesOfDay(w.startTime)), ...placed.map((p) => p.start));
  const lastMinute = Math.max(19 * 60, ...allWindows.map((w) => minutesOfDay(w.endTime)), ...placed.map((p) => p.end));
  const startHour = Math.floor(firstMinute / 60);
  const endHour = Math.ceil(lastMinute / 60);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const height = (endHour - startHour) * 60 * PX_PER_MIN;
  const y = (minute: number) => (minute - startHour * 60) * PX_PER_MIN;

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-xs">
      <div className={days.length > 1 ? "min-w-[760px]" : ""}>
        {/* Day headers */}
        <div className="grid border-b border-stone-200" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, 1fr)` }}>
          <div />
          {days.map((day) => (
            <div key={day} className="flex items-center justify-between gap-1 border-l border-stone-200 px-2 py-2">
              <Link
                href={`/dashboard/calendar?view=day&date=${day}`}
                className={`text-sm font-medium hover:underline ${day === today ? "text-amber-700" : ""}`}
              >
                {formatDayLabel(day)}
              </Link>
              <Link
                href={`/dashboard/appointments/new?date=${day}`}
                aria-label={`New appointment on ${formatDayLabel(day)}`}
                className="rounded px-1.5 text-lg leading-none text-stone-500 hover:bg-stone-100 hover:text-stone-900"
              >
                +
              </Link>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, 1fr)` }}>
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-xs text-stone-500" style={{ top: y(h * 60) }}>
                {h > startHour && `${String(h).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
            const windows = hoursByWeekday.get(weekday) ?? [];
            const dayItems = layoutLanes(
              placed.filter((p) => p.date === day),
              (p) => p.start,
              (p) => p.end,
            );
            return (
              <div key={day} className="relative border-l border-stone-200 bg-stone-100" style={{ height }}>
                {/* Opening hours shown as white, closed time stays grey */}
                {windows.map((w) => (
                  <div
                    key={w.startTime}
                    className="absolute inset-x-0 bg-white"
                    style={{ top: y(minutesOfDay(w.startTime)), height: (minutesOfDay(w.endTime) - minutesOfDay(w.startTime)) * PX_PER_MIN }}
                  />
                ))}
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-stone-200" style={{ top: y(h * 60) }} />
                ))}
                {dayItems.map(({ item, lane, lanes }) => (
                  <Link
                    key={item.appt.id}
                    href={`/dashboard/appointments/${item.appt.id}`}
                    className={`absolute overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-xs shadow-xs ${blockStyles[item.appt.status] ?? ""}`}
                    style={{
                      top: y(item.start) + 1,
                      height: Math.max((item.end - item.start) * PX_PER_MIN - 2, 18),
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                    }}
                  >
                    <span className="font-semibold">{toZonedHHMM(item.appt.startsAt, timezone)}</span>{" "}
                    <span className="font-medium">{item.appt.client.name}</span>
                    <span className="block truncate">
                      {item.appt.service.name}
                      {item.appt.source === "ONLINE" && <span className="ml-1 rounded bg-white/70 px-1 text-[10px] font-semibold uppercase">Online</span>}
                    </span>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
