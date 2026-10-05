import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SalonBooking } from "@/components/salon-booking";
import { SalonHeader } from "@/components/salon-header";
import { bookingWindow } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { imageUrl } from "@/lib/images";
import { describeDay, openNow, WEEKDAYS_MONDAY_FIRST } from "@/lib/opening";

async function load(slug: string) {
  await connection();
  return prisma.business.findUnique({
    where: { slug },
    include: {
      services: { where: { active: true }, orderBy: { name: "asc" } },
      workingHours: { select: { weekday: true, startTime: true, endTime: true } },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/book/[slug]">): Promise<Metadata> {
  const business = await load((await params).slug);
  if (!business) return { title: "Salon not found" };
  return {
    title: `Book with ${business.name}`,
    description: business.description?.slice(0, 160) ?? `Book an appointment with ${business.name} online.`,
    openGraph: { title: business.name, images: business.bannerImageId ? [imageUrl(business.bannerImageId)!] : [] },
  };
}

export default async function SalonPage({ params }: PageProps<"/book/[slug]">) {
  const business = await load((await params).slug);
  if (!business) notFound();

  const hours = business.workingHours;
  const status = openNow(hours, business.timezone);
  const phoneHref = business.phone ? `tel:${business.phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <div className="min-h-full bg-gradient-to-b from-amber-50 to-stone-50">
      <div className="mx-auto w-full max-w-4xl pb-10 sm:px-4 sm:pt-8">
        <SalonHeader
          name={business.name}
          avatarUrl={imageUrl(business.avatarImageId)}
          bannerUrl={imageUrl(business.bannerImageId)}
          badge={
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.open ? "bg-emerald-100 text-emerald-900" : "bg-stone-200 text-stone-700"}`}>
              {status.open ? `Open now · until ${status.until}` : "Closed now"}
            </span>
          }
          details={
            <>
              {business.address}
              {business.address && business.phone && " · "}
              {phoneHref && (
                <a href={phoneHref} className="hover:underline">
                  {business.phone}
                </a>
              )}
            </>
          }
          actions={
            business.services.length > 0 && (
              <a href="#services" className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-700">
                Book now
              </a>
            )
          }
        />

        <div className="mt-4 grid gap-4 px-4 sm:mt-6 sm:gap-6 sm:px-0 lg:grid-cols-[1fr_17rem]">
          <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
            {business.description && (
              <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
                <h2 className="mb-2 text-lg font-semibold">About</h2>
                <p className="whitespace-pre-line text-stone-700">{business.description}</p>
              </section>
            )}
            <SalonBooking
              slug={business.slug}
              services={business.services.map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description,
                durationMinutes: s.durationMinutes,
                priceCents: s.priceCents,
              }))}
              openWeekdays={[...new Set(hours.map((h) => h.weekday))]}
              window={bookingWindow(business)}
            />
          </div>

          <aside className="flex flex-col gap-4 sm:gap-6">
            <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-3 font-semibold">Opening hours</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {WEEKDAYS_MONDAY_FIRST.map(([day, label]) => (
                  <div key={day} className={`contents ${day === status.today ? "font-semibold" : ""}`}>
                    <dt className={day === status.today ? "text-stone-900" : "text-stone-600"}>{label}</dt>
                    <dd className="text-right tabular-nums">
                      {/* One line per opening window, so a lunch break never wraps mid-time */}
                      {describeDay(hours, day)
                        .split(", ")
                        .map((w) => (
                          <span key={w} className="block whitespace-nowrap">
                            {w}
                          </span>
                        ))}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-stone-500">Times in {business.timezone.replace("_", " ")} time.</p>
            </section>

            {(business.address || business.phone) && (
              <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-sm sm:p-5">
                <h2 className="mb-2 font-semibold">Find us</h2>
                {business.address && (
                  <>
                    <p className="text-stone-700">{business.address}</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block underline"
                    >
                      Open in Maps
                    </a>
                  </>
                )}
                {phoneHref && (
                  <p className="mt-2">
                    <a href={phoneHref} className="underline">
                      Call {business.phone}
                    </a>
                  </p>
                )}
              </section>
            )}
          </aside>
        </div>

        <p className="mt-8 text-center text-xs text-stone-500">
          Booking by{" "}
          <Link href="/" className="underline">
            BookMe
          </Link>
        </p>
      </div>
    </div>
  );
}
