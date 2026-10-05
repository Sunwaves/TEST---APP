// Demo data: one salon with services, opening hours, clients and a few bookings.
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { addDays } from "../src/lib/format";
import { addMinutes, toZonedIsoDate, zonedTimeToUtc } from "../src/lib/time";
import { DEMO_PASSWORD, ensureDemoUser } from "./demo-user";
import { DEMO_EMAIL } from "../src/lib/accounts";

const prisma = new PrismaClient();

/** First Monday–Friday after `isoDate`. The browser tests use the same rule. */
function nextWeekday(isoDate: string): string {
  let day = addDays(isoDate, 1);
  while ([0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay())) day = addDays(day, 1);
  return day;
}

async function main() {
  await prisma.business.deleteMany();
  await prisma.rateLimit.deleteMany(); // a demo reset also clears login/booking attempt counters

  const timezone = "Europe/London";
  const business = await prisma.business.create({
    data: {
      name: "Goldie Test Salon",
      slug: "goldie-test-salon",
      timezone,
      address: "12 Example Street, London",
      description:
        "A friendly neighbourhood salon for cuts, colour and nails. We take our time, use gentle products and love a good chat.\n\nNew clients welcome. Not sure what to book? Choose a haircut and tell us what you'd like in the notes.",
      phone: "+44 20 7946 0000",
      workingHours: {
        create: [1, 2, 3, 4, 5].flatMap((weekday) => [
          { weekday, startTime: "09:00", endTime: "13:00" },
          { weekday, startTime: "14:00", endTime: "18:00" },
        ]).concat([{ weekday: 6, startTime: "10:00", endTime: "16:00" }]),
      },
    },
  });

  await ensureDemoUser(prisma, business.id);

  const [cut, color, nails] = await Promise.all([
    prisma.service.create({ data: { businessId: business.id, name: "Haircut", durationMinutes: 45, bufferMinutes: 15, priceCents: 3500 } }),
    prisma.service.create({ data: { businessId: business.id, name: "Full colour", description: "Includes toner and blow-dry", durationMinutes: 120, bufferMinutes: 15, priceCents: 9500 } }),
    prisma.service.create({ data: { businessId: business.id, name: "Gel manicure", durationMinutes: 60, priceCents: 3000 } }),
  ]);

  const [ana, ben, cara] = await Promise.all([
    prisma.client.create({ data: { businessId: business.id, name: "Ana Pop", phone: "+44 7700 900001", email: "ana@example.com" } }),
    prisma.client.create({ data: { businessId: business.id, name: "Ben Ionescu", phone: "+44 7700 900002", notes: "Prefers short appointments" } }),
    prisma.client.create({ data: { businessId: business.id, name: "Cara Smith", email: "cara@example.com" } }),
  ]);

  // A couple of bookings on the next weekday (Mon–Fri) so the calendar isn't empty.
  const tomorrow = nextWeekday(toZonedIsoDate(new Date(), timezone));
  const book = (serviceId: string, clientId: string, time: string, minutes: number) => {
    const startsAt = zonedTimeToUtc(tomorrow, time, timezone);
    return prisma.appointment.create({
      data: {
        businessId: business.id,
        serviceId,
        clientId,
        startsAt,
        endsAt: addMinutes(startsAt, minutes),
        manageToken: randomBytes(18).toString("base64url"),
      },
    });
  };
  await book(cut.id, ana.id, "10:00", 60);
  await book(color.id, ben.id, "14:00", 135);

  // Eight weeks of history so Reports has something to show.
  const clients = [ana, ben, cara];
  const services = [
    { s: cut, minutes: 60 },
    { s: color, minutes: 135 },
    { s: nails, minutes: 60 },
  ];
  const statuses = ["COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "NO_SHOW", "CANCELLED"];
  const times = ["09:00", "11:30", "14:00", "16:00"];
  let n = 0;
  for (let daysAgo = 56; daysAgo >= 1; daysAgo--) {
    const day = toZonedIsoDate(addMinutes(new Date(), -daysAgo * 24 * 60), timezone);
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (weekday === 0) continue; // closed Sundays
    const perDay = 1 + ((daysAgo * 7) % 3);
    for (let i = 0; i < perDay; i++, n++) {
      const { s: service, minutes } = services[(daysAgo + i) % services.length];
      const startsAt = zonedTimeToUtc(day, times[i], timezone);
      await prisma.appointment.create({
        data: {
          businessId: business.id,
          serviceId: service.id,
          clientId: clients[(n * 5 + i) % clients.length].id,
          startsAt,
          endsAt: addMinutes(startsAt, minutes),
          status: statuses[n % statuses.length],
          source: n % 3 === 0 ? "ONLINE" : "STAFF",
          manageToken: randomBytes(18).toString("base64url"),
        },
      });
    }
  }

  console.log(`Seeded "${business.name}" (booking page: /book/${business.slug}, login: ${DEMO_EMAIL} / ${DEMO_PASSWORD})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
