import Link from "next/link";

/** Header pill: "PRO", or "Free · 12/20" with a colour hint as the limit gets close. */
export function PlanBadge({ pro, used, limit, warn, paused }: { pro: boolean; used: number; limit: number; warn: boolean; paused: boolean }) {
  const tone = pro
    ? "bg-amber-100 text-amber-900"
    : paused
      ? "bg-red-100 text-red-800"
      : warn
        ? "bg-amber-100 text-amber-900"
        : "bg-stone-100 text-stone-700";
  return (
    <Link href="/dashboard/billing" className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap hover:opacity-80 ${tone}`} title="Plan & billing">
      {pro ? "PRO" : `Free · ${used}/${limit}`}
    </Link>
  );
}
