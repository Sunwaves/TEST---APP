// Started by Playwright: fresh test database, demo data, then the production build on E2E_PORT.
// Run `npm run build` first (test:e2e does).
import { spawn, spawnSync } from "node:child_process";
import { isLocalUrl, recreateDatabase, startLocalPostgres } from "../scripts/local-db.mjs";
import { E2E_DATABASE_URL, E2E_PORT, e2eEnv } from "./env.mjs";

const stopDb = isLocalUrl(E2E_DATABASE_URL) ? await startLocalPostgres() : async () => {};
await recreateDatabase(E2E_DATABASE_URL);
for (const args of [["prisma", "migrate", "deploy"], ["prisma", "db", "seed"]]) {
  const r = spawnSync("npx", args, { env: e2eEnv, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const app = spawn("npx", ["next", "start", "-p", String(E2E_PORT)], { env: e2eEnv, stdio: "inherit" });
const shutdown = async () => {
  app.kill("SIGTERM");
  await stopDb().catch(() => {});
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
app.on("exit", async (code) => {
  await stopDb().catch(() => {});
  process.exit(code ?? 0);
});
