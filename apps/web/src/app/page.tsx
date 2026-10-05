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
  ["PATCH", "/api/appointments/:id", "Change status (complete, cancel, no-show)"],
  ["GET", "/api/availability?serviceId=&date=", "Bookable slots for a day"],
];

export default async function Home() {
  const business = await prisma.business.findFirst({
    include: { _count: { select: { services: true, clients: true, appointments: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Goldie Test App</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Phase 1: data model, booking rules and JSON API. The dashboard and public booking page come next.
      </p>

      <section className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        {business ? (
          <>
            <h2 className="font-medium">{business.name}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
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
      <ul className="mt-3 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        {endpoints.map(([method, path, desc]) => (
          <li key={path} className="flex flex-col gap-1 py-2 sm:flex-row sm:gap-4">
            <span className="w-24 shrink-0 font-mono text-zinc-500">{method}</span>
            <code className="font-mono">{path}</code>
            <span className="text-zinc-600 sm:ml-auto dark:text-zinc-400">{desc}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
