// Demo data: one salon with services, opening hours, clients and a few bookings.
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { addMinutes, toZonedIsoDate, zonedTimeToUtc } from "../src/lib/time";

const prisma = new PrismaClient();

async function main() {
  await prisma.business.deleteMany();

  const timezone = "Europe/London";
  const business = await prisma.business.create({
    data: {
      name: "Goldie Test Salon",
      slug: "goldie-test-salon",
      timezone,
      address: "12 Example Street, London",
      phone: "+44 20 7946 0000",
      workingHours: {
        create: [1, 2, 3, 4, 5].flatMap((weekday) => [
          { weekday, startTime: "09:00", endTime: "13:00" },
          { weekday, startTime: "14:00", endTime: "18:00" },
        ]).concat([{ weekday: 6, startTime: "10:00", endTime: "16:00" }]),
      },
    },
  });

  const [cut, color, nails] = await Promise.all([
    prisma.service.create({ data: { businessId: business.id, name: "Haircut", durationMinutes: 45, bufferMinutes: 15, priceCents: 3500 } }),
    prisma.service.create({ data: { businessId: business.id, name: "Full colour", description: "Includes toner and blow-dry", durationMinutes: 120, bufferMinutes: 15, priceCents: 9500 } }),
    prisma.service.create({ data: { businessId: business.id, name: "Gel manicure", durationMinutes: 60, priceCents: 3000 } }),
  ]);

  const [ana, ben] = await Promise.all([
    prisma.client.create({ data: { businessId: business.id, name: "Ana Pop", phone: "+44 7700 900001", email: "ana@example.com" } }),
    prisma.client.create({ data: { businessId: business.id, name: "Ben Ionescu", phone: "+44 7700 900002", notes: "Prefers short appointments" } }),
    prisma.client.create({ data: { businessId: business.id, name: "Cara Smith", email: "cara@example.com" } }),
  ]);

  // A couple of bookings tomorrow so the calendar isn't empty.
  const tomorrow = toZonedIsoDate(addMinutes(new Date(), 24 * 60), timezone);
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
  void nails;

  console.log(`Seeded "${business.name}" (booking page: /book/${business.slug})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
