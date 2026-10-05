import Link from "next/link";
import { NewAppointmentForm } from "@/components/new-appointment-form";
import { buttonClass, Card, PageHeader } from "@/components/ui";
import { dashboardBusiness } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { todayIn } from "@/lib/format";
import { isHHMM, isIsoDate } from "@/lib/time";

export default async function NewAppointmentPage({ searchParams }: PageProps<"/dashboard/appointments/new">) {
  const params = await searchParams;
  const business = await dashboardBusiness();
  const date = typeof params.date === "string" && isIsoDate(params.date) ? params.date : todayIn(business.timezone);
  const time = typeof params.time === "string" && isHHMM(params.time) ? params.time : undefined;
  const clientId = typeof params.clientId === "string" ? params.clientId : undefined;

  const [services, clients] = await Promise.all([
    prisma.service.findMany({ where: { businessId: business.id, active: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" }, select: { id: true, name: true, phone: true } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="New appointment"
        actions={
          <Link href={`/dashboard/calendar?date=${date}`} className={buttonClass.secondary}>
            Back to calendar
          </Link>
        }
      />
      <Card>
        {services.length ? (
          <NewAppointmentForm
            services={services}
            clients={clients}
            defaultDate={date}
            defaultTime={time}
            defaultClientId={clients.some((c) => c.id === clientId) ? clientId : undefined}
          />
        ) : (
          <p className="text-sm">
            Add a service first on the{" "}
            <Link href="/dashboard/services" className="underline">
              Services
            </Link>{" "}
            page.
          </p>
        )}
      </Card>
    </div>
  );
}
