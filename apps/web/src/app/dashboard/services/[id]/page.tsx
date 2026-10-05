import Link from "next/link";
import { notFound } from "next/navigation";
import { updateService } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/action-form";
import { buttonClass, Card, PageHeader } from "@/components/ui";
import { dashboardBusiness } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { ServiceFields } from "../fields";

export default async function ServicePage({ params }: PageProps<"/dashboard/services/[id]">) {
  const { id } = await params;
  const business = await dashboardBusiness();
  const service = await prisma.service.findFirst({ where: { id, businessId: business.id } });
  if (!service) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title={service.name}
        actions={
          <Link href="/dashboard/services" className={buttonClass.secondary}>
            All services
          </Link>
        }
      />
      <Card>
        <ActionForm action={updateService}>
          <input type="hidden" name="id" value={service.id} />
          <ServiceFields service={service} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={service.active} className="size-4 accent-stone-900" />
            Bookable (uncheck to hide it from new bookings; past appointments are kept)
          </label>
        </ActionForm>
      </Card>
    </div>
  );
}
