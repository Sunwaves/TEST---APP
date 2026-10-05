import Link from "next/link";
import { prisma } from "@/lib/db";

// Rendered per request so the counts reflect the live database.
export const dynamic = "force-dynamic";

const endpoints = [
  ["GET", "/api/business", "Business profile and opening hours"],
  ["GET / POST", "/api/services", "List or create services"],
  ["PATCH", "/api/services/:id", "Update a service"],
  ["GET / POST", "/api/clients?q=", "Search or create clients"],
  ["GET / PATCH", "/api/clients/:id", "Client profile with history"],
  ["GET / POST", "/api/appointments?from=&to=", "Calendar range or book (no double-booking)"],
  ["PATCH", "/api/appointments/:id", "Change status, notes or time (reschedule)"],
  ["PATCH", "/api/business", "Update name, timezone, slot interval, notice"],
  ["PUT", "/api/business/hours", "Replace weekly opening hours"],
  ["GET", "/api/availability?serviceId=&date=", "Bookable slots for a day"],
];

export default async function Home() {
  const business = await prisma.business.findFirst({
    include: { _count: { select: { services: true, clients: true, appointments: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Goldie Test App</h1>
      <p className="mt-2 text-stone-600">
        Appointment booking for beauty professionals. The public booking page comes in Phase 3.
      </p>
      <Link href="/dashboard" className="mt-6 inline-block rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
        Open dashboard
      </Link>

      <section className="mt-8 rounded-lg border border-stone-200 p-4">
        {business ? (
          <>
            <h2 className="font-medium">{business.name}</h2>
            <p className="text-sm text-stone-600">
              {business._count.services} services · {business._count.clients} clients ·{" "}
              {business._count.appointments} appointments · {business.timezone}
            </p>
          </>
        ) : (
          <p>
            No business yet. Run <code>npm run db:seed</code>.
          </p>
        )}
      </section>

      <h2 className="mt-8 text-xl font-semibold">API</h2>
      <ul className="mt-3 divide-y divide-stone-200 text-sm">
        {endpoints.map(([method, path, desc]) => (
          <li key={path} className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-4">
            <span className="w-24 shrink-0 font-mono text-stone-500">{method}</span>
            <code className="font-mono">{path}</code>
            <span className="text-stone-600 sm:ml-auto">{desc}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
