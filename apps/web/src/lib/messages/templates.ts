// Client message templates. Salons can override each one in Settings.

export type TemplateKind = "confirmation" | "reminder" | "cancellation" | "reschedule";

export const DEFAULT_TEMPLATES: Record<TemplateKind, string> = {
  confirmation:
    "Hi {client}, your {service} at {business} is booked for {date} at {time}. View or cancel: {link}",
  reminder: "Hi {client}, a reminder of your {service} at {business} on {date} at {time}. Need to cancel? {link}",
  cancellation: "Hi {client}, your {service} at {business} on {date} at {time} has been cancelled. Book again: {bookingPage}",
  reschedule: "Hi {client}, your {service} at {business} has moved to {date} at {time}. Details: {link}",
};

export const TEMPLATE_LABELS: Record<TemplateKind, string> = {
  confirmation: "Booking confirmation",
  reminder: "Reminder",
  cancellation: "Cancellation",
  reschedule: "Rescheduled",
};

export const PLACEHOLDERS: Record<string, string> = {
  client: "Client's first name",
  service: "Service name",
  date: "Appointment date, e.g. Friday 9 October",
  time: "Start time, e.g. 14:00",
  business: "Salon name",
  address: "Salon address",
  phone: "Salon phone",
  link: "Client's view/cancel link",
  bookingPage: "Your online booking page",
};

/** Replaces {placeholders}; unknown ones are left as typed so mistakes are visible. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}
