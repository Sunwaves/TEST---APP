import type { Service } from "@prisma/client";
import { Field, Input, Textarea } from "@/components/ui";

/** Inputs shared by the add and edit service forms. */
export function ServiceFields({ service }: { service?: Service }) {
  return (
    <>
      <Field label="Name">
        <Input name="name" defaultValue={service?.name} required />
      </Field>
      <Field label="Description">
        <Textarea name="description" rows={2} defaultValue={service?.description ?? ""} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Minutes">
          <Input name="durationMinutes" type="number" min={5} step={5} defaultValue={service?.durationMinutes ?? 60} required />
        </Field>
        <Field label="Buffer" hint="Clean-up after">
          <Input name="bufferMinutes" type="number" min={0} step={5} defaultValue={service?.bufferMinutes ?? 0} />
        </Field>
        <Field label="Price (RON)">
          <Input name="price" inputMode="decimal" defaultValue={service ? (service.priceCents / 100).toFixed(2).replace(".", ",") : ""} required />
        </Field>
      </div>
    </>
  );
}
