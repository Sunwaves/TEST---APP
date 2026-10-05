import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BookingFlow } from "@/components/booking-flow";
import { bookingWindow } from "@/lib/booking";
import { prisma } from "@/lib/db";

async function load(slug: string) {
  await connection();
  return prisma.business.findUnique({
    where: { slug },
    include: {
      services: { where: { active: true }, orderBy: { name: "asc" } },
      workingHours: { select: { weekday: true } },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/book/[slug]">): Promise<Metadata> {
  const business = await load((await params).slug);
  return { title: business ? `Book with ${business.name}` : "Salon not found" };
}

export default async function BookPage({ params }: PageProps<"/book/[slug]">) {
  const business = await load((await params).slug);
  if (!business) notFound();

  const openWeekdays = [...new Set(business.workingHours.map((h) => h.weekday))];

  return (
    <div className="min-h-full bg-gradient-to-b from-amber-50 to-stone-50">
      <div className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
        <header className="mb-8 text-center">
          <span aria-hidden className="mx-auto mb-3 block size-10 rounded-full bg-amber-400" />
          <h1 className="text-2xl font-semibold">{business.name}</h1>
          {(business.address || business.phone) && (
            <p className="mt-1 text-sm text-stone-600">{[business.address, business.phone].filter(Boolean).join(" · ")}</p>
          )}
        </header>
        <div className="rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-sm sm:p-6">
          {business.services.length ? (
            <BookingFlow
              slug={business.slug}
              services={business.services.map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description,
                durationMinutes: s.durationMinutes,
                priceCents: s.priceCents,
              }))}
              openWeekdays={openWeekdays}
              window={bookingWindow(business)}
            />
          ) : (
            <p className="text-center text-sm text-stone-600">Online booking isn&apos;t available yet. Please contact the salon.</p>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-stone-500">Times shown in {business.timezone.replace("_", " ")} time.</p>
      </div>
    </div>
  );
}
