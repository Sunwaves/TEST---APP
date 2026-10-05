import { prisma } from "../db";
import { deliverDue } from "./notify";

const globalForTimer = globalThis as unknown as { messageTimer?: NodeJS.Timeout };

export function startMessageTimer(intervalMs = 60_000) {
  if (globalForTimer.messageTimer) return; // survive dev hot reloads
  globalForTimer.messageTimer = setInterval(() => {
    deliverDue(prisma).catch((err) => console.error("Message delivery failed", err));
  }, intervalMs);
  globalForTimer.messageTimer.unref();
}
