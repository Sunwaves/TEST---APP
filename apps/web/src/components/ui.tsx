import type { ComponentProps, ReactNode } from "react";

// Small styling primitives shared by dashboard pages.

export const inputClass =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-xs outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:bg-stone-100";

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100 disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50",
};

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-stone-200 bg-white p-4 shadow-xs sm:p-5">
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const statusStyles: Record<string, string> = {
  BOOKED: "bg-amber-100 text-amber-900",
  COMPLETED: "bg-emerald-100 text-emerald-900",
  CANCELLED: "bg-stone-200 text-stone-600",
  NO_SHOW: "bg-red-100 text-red-800",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status] ?? ""}`}>{label}</span>
  );
}
