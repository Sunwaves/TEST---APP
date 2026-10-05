import Image from "next/image";
import type { ReactNode } from "react";

// Social-profile style header: banner, overlapping round photo, name and details.
// Used on the public salon page and as the live preview in the dashboard.

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter((w) => /[A-Za-z0-9]/.test(w[0] ?? ""))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "★"
  );
}

export function Banner({ url, className = "" }: { url: string | null; className?: string }) {
  return (
    <div className={`relative aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-amber-200 via-amber-100 to-rose-200 ${className}`}>
      {url && <Image src={url} alt="" fill unoptimized priority className="object-cover" sizes="(min-width: 768px) 768px, 100vw" />}
    </div>
  );
}

export function Avatar({ url, name, className = "size-24 sm:size-28" }: { url: string | null; name: string; className?: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full bg-amber-400 ring-4 ring-white ${className}`}>
      {url ? (
        <Image src={url} alt={`${name} profile photo`} fill unoptimized className="object-cover" sizes="112px" />
      ) : (
        <span aria-hidden className="flex size-full items-center justify-center text-2xl font-semibold text-amber-950 sm:text-3xl dark:text-[oklch(22%_0.05_50)]">
          {initials(name)}
        </span>
      )}
    </div>
  );
}

export function SalonHeader({
  name,
  avatarUrl,
  bannerUrl,
  details,
  badge,
  actions,
}: {
  name: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  details?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="overflow-hidden bg-white sm:rounded-2xl sm:border sm:border-stone-200 sm:shadow-sm">
      <Banner url={bannerUrl} />
      <div className="px-4 pb-5 sm:px-6">
        <div className="-mt-12 flex items-end justify-between gap-3 sm:-mt-14">
          <Avatar url={avatarUrl} name={name} />
          {actions && <div className="flex gap-2 pb-1">{actions}</div>}
        </div>
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{name}</h1>
            {badge}
          </div>
          {details && <div className="mt-1 text-sm text-stone-600">{details}</div>}
        </div>
      </div>
    </header>
  );
}
