"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { bookAppointment, BookingError, cancelByToken } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { businessBySlug } from "@/lib/public";
import { onlineBookingInput } from "@/lib/validation";

export interface PublicFormState {
  error?: string;
}

function field(fd: FormData, key: string): string | undefined {
  const value = fd.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function message(err: unknown): string {
  if (err instanceof BookingError) return err.message;
  if (err instanceof z.ZodError) return err.issues[0].message;
  throw err;
}

export async function createOnlineBooking(slug: string, _prev: PublicFormState, fd: FormData): Promise<PublicFormState> {
  // Spam trap: hidden from people and from browser autofill, so only bots fill it.
  if (field(fd, "hp_extra")) return { error: "Something went wrong. Please try again." };

  let token: string | null = null;
  try {
    const business = await businessBySlug(slug);
    const { serviceId, startsAt, notes, ...client } = onlineBookingInput.parse({
      serviceId: field(fd, "serviceId"),
      startsAt: field(fd, "startsAt"),
      name: field(fd, "name"),
      email: field(fd, "email"),
      phone: field(fd, "phone"),
      notes: field(fd, "notes"),
    });
    const appointment = await bookAppointment(prisma, business.id, { serviceId, startsAt, notes, client, source: "ONLINE" });
    token = appointment.manageToken;
  } catch (err) {
    return { error: message(err) };
  }
  redirect(`/booking/${token}?new=1`);
}

export async function cancelOnlineBooking(token: string): Promise<PublicFormState> {
  try {
    await cancelByToken(prisma, token);
  } catch (err) {
    return { error: message(err) };
  }
  redirect(`/booking/${token}`);
}
