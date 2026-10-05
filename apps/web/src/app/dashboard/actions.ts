"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentBusiness } from "@/lib/api";
import {
  bookAppointment,
  BookingError,
  rescheduleAppointment as moveAppointment,
  setWorkingHours,
  updateAppointment,
} from "@/lib/booking";
import { prisma } from "@/lib/db";
import { toZonedIsoDate, zonedTimeToUtc } from "@/lib/time";
import {
  appointmentStatus,
  businessInput,
  clientInput,
  hhmm,
  isoDate,
  serviceInput,
  workingHoursInput,
} from "@/lib/validation";

export interface FormState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/** Reads a form field, treating blank strings as missing. */
function field(fd: FormData, key: string): string | undefined {
  const value = fd.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function numberField(fd: FormData, key: string): number | undefined {
  const value = field(fd, key);
  return value === undefined ? undefined : Number(value);
}

/** "£35.50" / "35.5" -> 3550 */
function priceField(fd: FormData, key: string): number | undefined {
  const value = field(fd, key)?.replace(/[^0-9.]/g, "");
  return value ? Math.round(Number(value) * 100) : undefined;
}

function errorMessage(err: unknown): string {
  if (err instanceof BookingError) return err.message;
  if (err instanceof z.ZodError) {
    const issue = err.issues[0];
    const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
    return `${where}${issue.message}`;
  }
  throw err;
}

/** Runs a mutation, refreshes dashboard data, and turns expected errors into form state. */
async function run(fn: () => Promise<unknown>, message = "Saved"): Promise<FormState> {
  try {
    await fn();
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true, message };
}

function startsAtFrom(fd: FormData, timezone: string): Date {
  const date = isoDate.parse(field(fd, "date") ?? "");
  const time = hhmm.parse(field(fd, "time") ?? "");
  return zonedTimeToUtc(date, time, timezone);
}

// Appointments

export async function createAppointment(_prev: FormState, fd: FormData): Promise<FormState> {
  const business = await currentBusiness();
  let date = "";
  const state = await run(async () => {
    const startsAt = startsAtFrom(fd, business.timezone);
    date = toZonedIsoDate(startsAt, business.timezone);
    const clientId = field(fd, "clientId");
    await bookAppointment(prisma, business.id, {
      serviceId: z.string().min(1, "Choose a service").parse(field(fd, "serviceId") ?? ""),
      startsAt,
      notes: field(fd, "notes"),
      source: "STAFF",
      ...(clientId && clientId !== "new"
        ? { clientId }
        : {
            client: clientInput.parse({
              name: field(fd, "clientName"),
              phone: field(fd, "clientPhone"),
              email: field(fd, "clientEmail"),
            }),
          }),
    });
  });
  if (state.error) return state;
  redirect(`/dashboard/calendar?date=${date}`);
}

export async function setAppointmentStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  const business = await currentBusiness();
  return run(
    () => updateAppointment(prisma, business.id, field(fd, "id") ?? "", { status: appointmentStatus.parse(field(fd, "status")) }),
    "Status updated",
  );
}

export async function saveAppointmentNotes(_prev: FormState, fd: FormData): Promise<FormState> {
  const business = await currentBusiness();
  return run(() => updateAppointment(prisma, business.id, field(fd, "id") ?? "", { notes: field(fd, "notes") ?? "" }));
}

export async function rescheduleAppointment(_prev: FormState, fd: FormData): Promise<FormState> {
  const business = await currentBusiness();
  return run(
    () => moveAppointment(prisma, business.id, field(fd, "id") ?? "", startsAtFrom(fd, business.timezone)),
    "Appointment moved",
  );
}

// Clients

function clientFromForm(fd: FormData) {
  return clientInput.parse({
    name: field(fd, "name"),
    phone: field(fd, "phone"),
    email: field(fd, "email"),
    notes: field(fd, "notes"),
  });
}

export async function createClient(_prev: FormState, fd: FormData): Promise<FormState> {
  const business = await currentBusiness();
  return run(() => prisma.client.create({ data: { ...clientFromForm(fd), businessId: business.id } }), "Client added");
}

export async function updateClient(_prev: FormState, fd: FormData): Promise<FormState> {
  const business = await currentBusiness();
  return run(async () => {
    const data = clientFromForm(fd);
    // Blank optional fields clear the stored value.
    const { count } = await prisma.client.updateMany({
      where: { id: field(fd, "id"), businessId: business.id },
      data: { name: data.name, phone: data.phone ?? null, email: data.email ?? null, notes: data.notes ?? null },
    });
    if (!count) throw new BookingError("Client not found", 404);
  });
}

// Services

function serviceFromForm(fd: FormData) {
  return serviceInput.parse({
    name: field(fd, "name"),
    description: field(fd, "description"),
    durationMinutes: numberField(fd, "durationMinutes"),
    bufferMinutes: numberField(fd, "bufferMinutes") ?? 0,
    priceCents: priceField(fd, "price"),
    active: fd.has("active") ? fd.get("active") === "on" : true,
  });
}

export async function createService(_prev: FormState, fd: FormData): Promise<FormState> {
  const business = await currentBusiness();
  return run(() => prisma.service.create({ data: { ...serviceFromForm(fd), businessId: business.id } }), "Service added");
}

export async function updateService(_prev: FormState, fd: FormData): Promise<FormState> {
  const business = await currentBusiness();
  return run(async () => {
    const parsed = serviceFromForm(fd);
    const data = { ...parsed, description: parsed.description ?? null, active: fd.get("active") === "on" };
    const { count } = await prisma.service.updateMany({ where: { id: field(fd, "id"), businessId: business.id }, data });
    if (!count) throw new BookingError("Service not found", 404);
  });
}

// Settings

export async function updateBusiness(_prev: FormState, fd: FormData): Promise<FormState> {
  const business = await currentBusiness();
  return run(() => {
    const data = businessInput.parse({
      name: field(fd, "name"),
      timezone: field(fd, "timezone"),
      slotStepMinutes: numberField(fd, "slotStepMinutes"),
      minNoticeMinutes: numberField(fd, "minNoticeMinutes"),
      maxAdvanceDays: numberField(fd, "maxAdvanceDays"),
      phone: field(fd, "phone"),
      address: field(fd, "address"),
    });
    return prisma.business.update({
      where: { id: business.id },
      data: { ...data, phone: data.phone ?? null, address: data.address ?? null },
    });
  });
}

/** Expects parallel `weekday`, `startTime`, `endTime` fields, one triple per opening window. */
export async function saveWorkingHours(_prev: FormState, fd: FormData): Promise<FormState> {
  const business = await currentBusiness();
  return run(() => {
    const weekdays = fd.getAll("weekday");
    const starts = fd.getAll("startTime");
    const ends = fd.getAll("endTime");
    const hours = workingHoursInput.parse(
      weekdays.map((weekday, i) => ({ weekday: Number(weekday), startTime: starts[i], endTime: ends[i] })),
    );
    return setWorkingHours(prisma, business.id, hours);
  }, "Opening hours saved");
}
