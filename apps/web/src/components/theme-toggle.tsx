"use client";

import { THEME_COOKIE } from "@/lib/theme";

// Switches between light and dark and remembers the choice for a year (per browser).
// Both icons are rendered and CSS shows the right one, so server and browser HTML always match.
export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const current = root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex size-9 items-center justify-center rounded-full text-stone-700 hover:bg-stone-100 ${className}`}
    >
      {/* Moon in light mode (switch to dark), sun in dark mode (switch to light) */}
      <svg aria-hidden viewBox="0 0 24 24" className="size-5 dark:hidden" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
      <svg aria-hidden viewBox="0 0 24 24" className="hidden size-5 dark:block" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <span className="sr-only dark:hidden">Switch to dark theme</span>
      <span className="sr-only hidden dark:inline">Switch to light theme</span>
    </button>
  );
}

/** Round button in the page's top-right corner (scrolls away with the page), for pages without a header bar. */
export function FloatingThemeToggle() {
  return (
    <div className="absolute top-3 right-3 z-30 rounded-full border border-stone-200 bg-white/85 shadow-sm backdrop-blur">
      <ThemeToggle />
    </div>
  );
}
