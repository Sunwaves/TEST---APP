"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/services", label: "Services" },
  { href: "/dashboard/messages", label: "Messages" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto">
      {links.map((link) => {
        const active = pathname.startsWith(link.href) || (link.href.endsWith("calendar") && pathname.startsWith("/dashboard/appointments"));
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
              active ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-200"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
