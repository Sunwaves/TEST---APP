import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { PrismaClient } from "@prisma/client";

// Password hashing, login sessions and password resets.
// Framework-free so it can be unit-tested; see session.ts for the cookie side.

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_DAYS = 30;
const RESET_MINUTES = 60;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Random token for the browser, plus the hash we keep in the database. */
function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(db: PrismaClient, userId: string, now = new Date()) {
  const { token, hash } = newToken();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { id: hash, userId, expiresAt } });
  return { token, expiresAt };
}

/** The logged-in user (with their business) for a session token, or null if missing/expired. */
export async function userForSession(db: PrismaClient, token: string | undefined, now = new Date()) {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { include: { business: true } } },
  });
  if (!session) return null;
  if (session.expiresAt <= now) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function deleteSession(db: PrismaClient, token: string) {
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}

/** Returns the user if the email/password match. Always does the hashing work, so timing doesn't reveal which emails exist. */
export async function checkLogin(db: PrismaClient, email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  return user && ok ? user : null;
}
const DUMMY_HASH = "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

/** Creates a one-hour reset token for the account with this email, if there is one. */
export async function createPasswordReset(db: PrismaClient, email: string, now = new Date()) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return null;
  const { token, hash } = newToken();
  await db.passwordReset.create({
    data: { id: hash, userId: user.id, expiresAt: new Date(now.getTime() + RESET_MINUTES * 60_000) },
  });
  return { token, user };
}

export async function findPasswordReset(db: PrismaClient, token: string, now = new Date()) {
  const reset = await db.passwordReset.findUnique({ where: { id: hashToken(token) } });
  return reset && !reset.usedAt && reset.expiresAt > now ? reset : null;
}

/** Sets the new password, uses up the token and logs the user out everywhere. */
export async function resetPassword(db: PrismaClient, token: string, password: string, now = new Date()) {
  const reset = await findPasswordReset(db, token, now);
  if (!reset) return false;
  const passwordHash = await hashPassword(password);
  await db.$transaction([
    db.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
    db.passwordReset.update({ where: { id: reset.id }, data: { usedAt: now } }),
    db.session.deleteMany({ where: { userId: reset.userId } }),
  ]);
  return true;
}
