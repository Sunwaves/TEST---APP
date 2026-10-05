import Link from "next/link";
import { updateBusiness } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/action-form";
import { HoursEditor } from "@/components/hours-editor";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { dashboardBusiness } from "@/lib/dashboard";
import { prisma } from "@/lib/db";

const TIMEZONES = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Bucharest",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Sydney",
];

export default async function SettingsPage() {
  const business = await dashboardBusiness();
  const hours = await prisma.workingHours.findMany({
    where: { businessId: business.id },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    select: { weekday: true, startTime: true, endTime: true },
  });
  const timezones = TIMEZONES.includes(business.timezone) ? TIMEZONES : [business.timezone, ...TIMEZONES];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <div className="grid gap-6">
        <Card title="Online booking page">
          <p className="text-sm text-stone-600">Share this link with clients so they can book themselves:</p>
          <p className="mt-2 flex flex-wrap items-center gap-3">
            <code className="rounded bg-stone-100 px-2 py-1 text-sm">/book/{business.slug}</code>
            <Link href={`/book/${business.slug}`} target="_blank" className="text-sm underline">
              Open booking page
            </Link>
          </p>
        </Card>
        <Card title="Business">
          <ActionForm action={updateBusiness}>
            <Field label="Business name">
              <Input name="name" defaultValue={business.name} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Address" hint="Shown on your booking page">
                <Input name="address" defaultValue={business.address ?? ""} />
              </Field>
              <Field label="Phone" hint="Shown on your booking page">
                <Input name="phone" type="tel" defaultValue={business.phone ?? ""} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Timezone">
                <Select name="timezone" defaultValue={business.timezone}>
                  {timezones.map((tz) => (
                    <option key={tz}>{tz}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Slot interval" hint="How often booking times start">
                <Select name="slotStepMinutes" defaultValue={business.slotStepMinutes}>
                  {[5, 10, 15, 20, 30, 60].map((m) => (
                    <option key={m} value={m}>
                      Every {m} min
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Minimum notice" hint="For online bookings">
                <Select name="minNoticeMinutes" defaultValue={business.minNoticeMinutes}>
                  {[
                    [0, "None"],
                    [30, "30 minutes"],
                    [60, "1 hour"],
                    [120, "2 hours"],
                    [240, "4 hours"],
                    [1440, "1 day"],
                    [2880, "2 days"],
                  ].map(([m, label]) => (
                    <option key={m} value={m}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Book ahead" hint="How far ahead clients can book online">
                <Select name="maxAdvanceDays" defaultValue={business.maxAdvanceDays}>
                  {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                    <option key={d} value={d}>
                      {d < 30 ? `${d / 7} week${d === 7 ? "" : "s"}` : d === 365 ? "1 year" : `${Math.round(d / 30)} month${d === 30 ? "" : "s"}`}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </ActionForm>
        </Card>

        <Card title="Opening hours">
          <HoursEditor initial={hours} />
        </Card>
      </div>
    </div>
  );
}
