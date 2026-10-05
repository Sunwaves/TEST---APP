import Link from "next/link";
import { updateProfile } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/action-form";
import { ImageUpload } from "@/components/image-upload";
import { SalonHeader } from "@/components/salon-header";
import { buttonClass, Card, Field, PageHeader, Textarea } from "@/components/ui";
import { dashboardBusiness } from "@/lib/dashboard";
import { imageUrl } from "@/lib/images";

export default async function ProfilePage() {
  const business = await dashboardBusiness();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Salon page"
        subtitle="What clients see when they open your booking link."
        actions={
          <Link href={`/book/${business.slug}`} target="_blank" className={buttonClass.secondary}>
            View your page ↗
          </Link>
        }
      />

      <div className="grid gap-6">
        <div>
          <p className="mb-2 text-sm font-medium text-stone-600">Preview</p>
          <SalonHeader
            name={business.name}
            avatarUrl={imageUrl(business.avatarImageId)}
            bannerUrl={imageUrl(business.bannerImageId)}
            details={[business.address, business.phone].filter(Boolean).join(" · ") || "Add your address and phone in Settings"}
          />
        </div>

        <Card title="Pictures">
          <div className="grid gap-5">
            <div>
              <p className="text-sm font-medium">Profile photo</p>
              <p className="mb-2 text-xs text-stone-500">Your logo or a photo of you. Cropped to a circle.</p>
              <ImageUpload kind="AVATAR" hasImage={!!business.avatarImageId} label="Photo" />
            </div>
            <div>
              <p className="text-sm font-medium">Banner</p>
              <p className="mb-2 text-xs text-stone-500">A wide picture of your salon or your work. Cropped to 3:1 (e.g. 1500 × 500).</p>
              <ImageUpload kind="BANNER" hasImage={!!business.bannerImageId} label="Banner" />
            </div>
          </div>
        </Card>

        <Card title="About">
          <ActionForm action={updateProfile}>
            <Field label="Description" hint="A few sentences about you, your style and what clients can expect. Up to 1000 characters.">
              <Textarea name="description" rows={5} maxLength={1000} defaultValue={business.description ?? ""} />
            </Field>
          </ActionForm>
          <p className="mt-4 text-xs text-stone-500">
            Name, address and phone are edited in{" "}
            <Link href="/dashboard/settings" className="underline">
              Settings
            </Link>
            ; services in{" "}
            <Link href="/dashboard/services" className="underline">
              Services
            </Link>
            .
          </p>
        </Card>
      </div>
    </div>
  );
}
