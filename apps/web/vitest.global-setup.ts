import { execSync } from "node:child_process";
import { isLocalUrl, recreateDatabase, startLocalPostgres } from "./scripts/local-db.mjs";
import { TEST_DATABASE_URL } from "./vitest.config";

// Gives integration tests a fresh Postgres database with the current migrations.
// Locally this starts the private Postgres from `npm start`; CI provides TEST_DATABASE_URL.
export default async function setup() {
  const stop: () => Promise<void> = isLocalUrl(TEST_DATABASE_URL) ? await startLocalPostgres() : async () => {};
  await recreateDatabase(TEST_DATABASE_URL);
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DATABASE_URL_UNPOOLED: TEST_DATABASE_URL },
    stdio: "ignore",
  });
  return stop;
}
