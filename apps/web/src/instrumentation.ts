// Runs once when the server starts. On a long-running server (local `npm start`, Docker)
// this delivers reminders every minute. Serverless hosts should call /api/cron/messages instead.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_MESSAGE_TIMER === "1") return;
  const { startMessageTimer } = await import("./lib/messages/timer");
  startMessageTimer();
}
