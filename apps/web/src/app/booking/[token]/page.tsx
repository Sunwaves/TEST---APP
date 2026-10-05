import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CancelBooking } from "@/components/cancel-booking";
import { buttonClass } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDateTime, formatDuration, formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Your booking",
  robots: { index: false }, // private link
};

export default async function BookingPage({ params, searchParams }: PageProps<"/booking/[token]">) {
  await connection();
  const { token } = await params;
  const justBooked = (await searchParams).new === "1";
  const appointment = await prisma.appointment.findUnique({
    where: { manageToken: token },
    include: { service: true, client: true, business: true },
  });
  if (!appointment) notFound();

  const { business, service } = appointment;
  const cancelled = appointment.status === "CANCELLED";
  const upcoming = appointment.status === "BOOKED" && appointment.startsAt > new Date();
  const heading = cancelled
    ? "Booking cancelled"
    : justBooked
      ? `You're booked, ${appointment.client.name.split(" ")[0]}!`
      : upcoming
        ? "Your upcoming appointment"
        : "Your appointment";

  return (
    <div className="min-h-full bg-gradient-to-b from-amber-50 to-stone-50">
      <div className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-6 text-center">
            <span
              aria-hidden
              className={`mx-auto mb-3 flex size-12 items-center justify-center rounded-full text-2xl ${cancelled ? "bg-stone-200 text-stone-600" : "bg-emerald-100 text-emerald-700"}`}
            >
              {cancelled ? "×" : "✓"}
            </span>
            <h1 className="text-2xl font-semibold">{heading}</h1>
            {justBooked && !cancelled && <p className="mt-1 text-sm text-stone-600">Keep this page&apos;s link to view or cancel your booking.</p>}
          </div>

          <dl className={`grid grid-cols-[6rem_1fr] gap-y-2 text-sm ${cancelled ? "text-stone-500 line-through" : ""}`}>
            <dt className="text-stone-500">Service</dt>
            <dd className="font-medium">
              {service.name} · {formatDuration(service.durationMinutes)}
            </dd>
            <dt className="text-stone-500">When</dt>
            <dd className="font-medium">{formatDateTime(appointment.startsAt, business.timezone)}</dd>
            <dt className="text-stone-500">Price</dt>
            <dd>{formatPrice(service.priceCents)}</dd>
            <dt className="text-stone-500">Where</dt>
            <dd>
              {business.name}
              {business.address && <span className="block text-stone-600">{business.address}</span>}
            </dd>
            {business.phone && (
              <>
                <dt className="text-stone-500">Contact</dt>
                <dd>
                  <a href={`tel:${business.phone.replace(/\s/g, "")}`} className="underline">
                    {business.phone}
                  </a>
                </dd>
              </>
            )}
          </dl>

          <div className="mt-6 flex flex-col gap-3 border-t border-stone-200 pt-6">
            {upcoming && (
              <>
                <a href={`/api/public/bookings/${token}/ics`} className={buttonClass.secondary}>
                  Add to calendar
                </a>
                <CancelBooking token={token} />
              </>
            )}
            <Link href={`/book/${business.slug}`} className={upcoming ? "text-center text-sm text-stone-600 underline" : buttonClass.primary}>
              {cancelled ? "Book another time" : "Book another appointment"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
