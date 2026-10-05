import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAccount, slugify } from "./accounts";
import {
  checkLogin,
  createPasswordReset,
  createSession,
  deleteSession,
  findPasswordReset,
  hashPassword,
  resetPassword,
  userForSession,
  verifyPassword,
} from "./auth";
import { BookingError } from "./booking";

const db = new PrismaClient();
const signup = { name: "Ana Pop", salonName: "Ana's Hair & Nails", email: "Ana@Example.com", password: "secret123" };

beforeEach(async () => {
  await db.business.deleteMany();
});
afterAll(() => db.$disconnect());

describe("passwords", () => {
  it("hashes with a random salt and verifies", async () => {
    const a = await hashPassword("secret123");
    const b = await hashPassword("secret123");
    expect(a).not.toBe(b);
    expect(await verifyPassword("secret123", a)).toBe(true);
    expect(await verifyPassword("wrong", a)).toBe(false);
    expect(await verifyPassword("secret123", "garbage")).toBe(false);
  });
});

describe("accounts", () => {
  it("slugifies salon names", () => {
    expect(slugify("Ana's Hair & Nails")).toBe("ana-s-hair-nails");
    expect(slugify("Salon Élégance")).toBe("salon-elegance");
    expect(slugify("!!!")).toBe("salon");
  });

  it("creates the owner, their salon, default hours and a unique booking address", async () => {
    const user = await createAccount(db, signup);
    expect(user.email).toBe("ana@example.com");
    expect(user.business.slug).toBe("ana-s-hair-nails");
    expect(user.business.notifyEmail).toBe("ana@example.com");
    expect(await db.workingHours.count({ where: { businessId: user.businessId } })).toBe(6);

    const second = await createAccount(db, { ...signup, email: "other@example.com" });
    expect(second.business.slug).toBe("ana-s-hair-nails-2");
  });

  it("refuses a duplicate email in any letter case", async () => {
    await createAccount(db, signup);
    const err = await createAccount(db, { ...signup, email: "ANA@example.com" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BookingError);
  });

  it("checks logins case-insensitively on email", async () => {
    await createAccount(db, signup);
    expect(await checkLogin(db, " ana@EXAMPLE.com ", "secret123")).not.toBeNull();
    expect(await checkLogin(db, "ana@example.com", "nope")).toBeNull();
    expect(await checkLogin(db, "nobody@example.com", "secret123")).toBeNull();
  });
});

describe("sessions", () => {
  it("finds the user for a token, stores only a hash, and expires", async () => {
    const user = await createAccount(db, signup);
    const now = new Date("2026-10-05T12:00:00Z");
    const { token } = await createSession(db, user.id, now);

    expect((await userForSession(db, token, now))?.business.id).toBe(user.businessId);
    expect(await db.session.findUnique({ where: { id: token } })).toBeNull(); // raw token not stored
    expect(await userForSession(db, "made-up", now)).toBeNull();
    expect(await userForSession(db, undefined, now)).toBeNull();

    const later = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
    expect(await userForSession(db, token, later)).toBeNull();
    expect(await db.session.count()).toBe(0); // expired session cleaned up
  });

  it("logs out", async () => {
    const user = await createAccount(db, signup);
    const { token } = await createSession(db, user.id);
    await deleteSession(db, token);
    expect(await userForSession(db, token)).toBeNull();
  });
});

describe("password reset", () => {
  it("resets once, within an hour, and signs out other sessions", async () => {
    const user = await createAccount(db, signup);
    const { token: session } = await createSession(db, user.id);
    const now = new Date();

    expect(await createPasswordReset(db, "nobody@example.com", now)).toBeNull();
    const reset = await createPasswordReset(db, "ANA@example.com", now);
    expect(reset).not.toBeNull();

    expect(await findPasswordReset(db, reset!.token, new Date(now.getTime() + 61 * 60_000))).toBeNull();
    expect(await resetPassword(db, reset!.token, "newpass123", now)).toBe(true);
    expect(await resetPassword(db, reset!.token, "again1234", now)).toBe(false);

    expect(await checkLogin(db, "ana@example.com", "newpass123")).not.toBeNull();
    expect(await checkLogin(db, "ana@example.com", "secret123")).toBeNull();
    expect(await userForSession(db, session)).toBeNull();
  });
});
