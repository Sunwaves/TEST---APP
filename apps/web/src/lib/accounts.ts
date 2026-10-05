import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./auth";
import { BookingError } from "./booking";
import { trialEndsAt } from "./plans";

/** Demo owner created by the seed script (password: demo1234). */
export const DEMO_EMAIL = "demo@goldie.test";

export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "salon"
  );
}

export interface SignupInput {
  name: string;
  salonName: string;
  email: string;
  password: string;
  timezone?: string;
}

/** Creates an owner account and their salon with sensible default opening hours. */
export async function createAccount(db: PrismaClient, input: SignupInput) {
  const email = input.email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    throw new BookingError("An account with this email already exists. Try logging in.", 409);
  }

  // Booking-page address: the salon name, with a number added if it's taken.
  const base = slugify(input.salonName);
  let slug = base;
  for (let n = 2; await db.business.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`;

  const passwordHash = await hashPassword(input.password);
  return db.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash,
      business: {
        create: {
          name: input.salonName.trim(),
          slug,
          timezone: input.timezone ?? "Europe/London",
          notifyEmail: email,
          proUntil: trialEndsAt(), // 14-day PRO trial, no card needed
          workingHours: {
            create: [1, 2, 3, 4, 5]
              .map((weekday) => ({ weekday, startTime: "09:00", endTime: "17:00" }))
              .concat({ weekday: 6, startTime: "10:00", endTime: "16:00" }),
          },
        },
      },
    },
    include: { business: true },
  });
}
