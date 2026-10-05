import { after } from "next/server";
import { prisma } from "../db";
import { deliverDue } from "./notify";

export * from "./notify";

/**
 * Runs an event's notifications after the response is sent, then delivers whatever is due.
 * Failures are logged, never shown to the person who made the booking.
 */
export function notifyAfterResponse(work: () => Promise<unknown>) {
  after(async () => {
    try {
      await work();
      await deliverDue(prisma);
    } catch (err) {
      console.error("Notification failed", err);
    }
  });
}
