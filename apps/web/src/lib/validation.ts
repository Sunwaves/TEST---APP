import { z } from "zod";
import { isHHMM, isIsoDate } from "./time";

export const isoDate = z.string().refine(isIsoDate, "Expected a date as YYYY-MM-DD");
export const hhmm = z.string().refine(isHHMM, "Expected a time as HH:MM");

export const serviceInput = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  durationMinutes: z.number().int().min(5).max(8 * 60),
  bufferMinutes: z.number().int().min(0).max(4 * 60).default(0),
  priceCents: z.number({ error: "Enter a price, e.g. 120 or 99,50" }).int().min(0, "Enter a price, e.g. 120 or 99,50"),
  active: z.boolean().default(true),
});

export const clientInput = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).optional(),
  email: z.email().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const appointmentInput = z.object({
  serviceId: z.string().min(1),
  startsAt: z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
  notes: z.string().trim().max(1000).optional(),
  // Either an existing client or the details of a new one.
  clientId: z.string().min(1).optional(),
  client: clientInput.optional(),
}).refine((v) => v.clientId || v.client, { message: "Provide clientId or client", path: ["clientId"] });

export const appointmentStatus = z.enum(["BOOKED", "COMPLETED", "CANCELLED", "NO_SHOW"]);

export const appointmentUpdate = z.object({
  status: appointmentStatus.optional(),
  notes: z.string().trim().max(1000).optional(),
  startsAt: z.iso.datetime({ offset: true }).transform((s) => new Date(s)).optional(),
});

export const workingHoursInput = z.array(
  z.object({ weekday: z.number().int().min(0).max(6), startTime: hhmm, endTime: hhmm }),
).max(50);

export const businessInput = z.object({
  name: z.string().trim().min(1).max(100),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone"),
  slotStepMinutes: z.number().int().min(5).max(120),
  minNoticeMinutes: z.number().int().min(0).max(14 * 24 * 60),
  maxAdvanceDays: z.number().int().min(1).max(365),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(200).optional(),
});

/** What a client submits from the public booking page. */
export const onlineBookingInput = z.object({
  serviceId: z.string().min(1, "Choose a service"),
  startsAt: z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.email("Enter a valid email").transform((e) => e.toLowerCase()).optional(),
  phone: z.string().trim().min(6, "Enter a valid phone number").max(30).optional(),
  notes: z.string().trim().max(500).optional(),
}).refine((v) => v.email || v.phone, { message: "Enter an email or phone number so the salon can reach you", path: ["email"] });

export const availabilityQuery = z.object({
  serviceId: z.string().min(1),
  date: isoDate,
});

export const rangeQuery = z.object({
  from: z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
  to: z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
});
