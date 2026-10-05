import type { Appointment, Business, Service } from "@prisma/client";
import { BookingError } from "./booking";
import { prisma } from "./db";
import { buildIcs } from "./ics";

export async function businessBySlug(slug: string) {
  const business = await prisma.business.findUnique({ where: { slug } });
  if (!business) throw new BookingError("Salon not found", 404);
  return business;
}

export async function bookingByToken(token: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { manageToken: token },
    include: { service: true, client: true, business: true },
  });
  if (!appointment) throw new BookingError("Booking not found", 404);
  return appointment;
}

/** The fields of a booking that are safe to show the client (no staff notes). */
export function publicBooking(a: Appointment & { service: Service; business: Business; client: { name: string } }) {
  return {
    token: a.manageToken,
    status: a.status,
    startsAt: a.startsAt.toISOString(),
    endsAt: new Date(a.startsAt.getTime() + a.service.durationMinutes * 60_000).toISOString(),
    clientName: a.client.name,
    service: { name: a.service.name, durationMinutes: a.service.durationMinutes, priceCents: a.service.priceCents },
    business: { name: a.business.name, slug: a.business.slug, timezone: a.business.timezone, address: a.business.address, phone: a.business.phone },
  };
}

export function bookingIcs(a: Parameters<typeof publicBooking>[0]) {
  const b = publicBooking(a);
  return buildIcs({
    uid: `${a.id}@goldie-test-app`,
    start: new Date(b.startsAt),
    end: new Date(b.endsAt),
    summary: `${b.service.name} at ${b.business.name}`,
    location: b.business.address ?? undefined,
    description: b.business.phone ? `Questions? Call ${b.business.phone}` : undefined,
    cancelled: a.status === "CANCELLED",
  });
}
