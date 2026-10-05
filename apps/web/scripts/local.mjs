// One-command local run: `npm start` from the repo root.
// Installs dependencies, starts a private Postgres, creates/updates the database,
// adds demo data on first run, then starts the app. Safe to run again: it never wipes data.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(web, ".env");
const port = process.env.PORT ?? "3000";

function run(command, args, label, env = process.env) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { cwd: web, stdio: "inherit", env, shell: process.platform === "win32" });
  if (result.status !== 0) {
    console.error(`\n✖ ${label} failed. See the messages above.`);
    process.exit(result.status ?? 1);
  }
}

function readEnv() {
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const [major] = process.versions.node.split(".").map(Number);
if (major < 20) {
  console.error(`✖ Node.js ${process.versions.node} is too old. Install Node.js 22 from https://nodejs.org and try again.`);
  process.exit(1);
}

// If an older copy is still running, the browser would keep talking to it (old code, old database client).
const portFree = await new Promise((resolve) => {
  const probe = createServer()
    .once("error", () => resolve(false))
    .once("listening", () => probe.close(() => resolve(true)))
    .listen(Number(port));
});
if (!portFree) {
  console.error(`✖ Port ${port} is already in use, probably by an older copy of this app.
  Stop it first: go to the Terminal window where it is running and press Ctrl+C
  (or close that window), then run npm start again.
  To run a second copy instead, use a different port: PORT=3001 npm start`);
  process.exit(1);
}

if (!existsSync(envPath)) {
  copyFileSync(join(web, ".env.example"), envPath);
  console.log("▶ Created apps/web/.env");
} else if (readEnv().DATABASE_URL?.startsWith("file:")) {
  // Setups from before the move to Postgres still point at the old SQLite file.
  writeFileSync(join(web, ".env.sqlite-backup"), readFileSync(envPath));
  copyFileSync(join(web, ".env.example"), envPath);
  console.log("▶ Switched your local database from SQLite to Postgres (old settings saved in apps/web/.env.sqlite-backup).");
  console.log("  Your old test data stays in apps/web/prisma/dev.db but is not copied over; a fresh demo salon will be created.");
}

run("npm", ["install", "--no-audit", "--no-fund"], "Installing dependencies (first time takes a minute)");

const env = { ...process.env, ...readEnv() };
const { ensureDatabase, isLocalUrl, startLocalPostgres } = await import("./local-db.mjs");
let stopDb = async () => {};
if (isLocalUrl(env.DATABASE_URL)) {
  console.log("\n▶ Starting the local database");
  stopDb = await startLocalPostgres();
  await ensureDatabase(env.DATABASE_URL);
}

run("npx", ["prisma", "migrate", "deploy"], "Updating the database", env);

// Seed demo data only if the database is empty; add the demo login to databases that have none.
const check = spawnSync(
  process.execPath,
  [
    "-e",
    "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();Promise.all([p.business.count(),p.user.count()]).then(([b,u])=>{console.log(JSON.stringify({b,u}));return p.$disconnect()})",
  ],
  { cwd: web, encoding: "utf8", env },
);
const counts = JSON.parse(check.stdout.trim() || '{"b":0,"u":0}');
if (counts.b === 0) run("npx", ["prisma", "db", "seed"], "Adding demo salon data", env);
else if (counts.u === 0) run("npx", ["tsx", "prisma/demo-user.ts"], "Adding the demo login to your existing salon", env);

console.log(`
✔ Ready. Open these in your browser:
   Dashboard:     http://localhost:${port}/dashboard   (demo login: demo@goldie.test / demo1234)
   Booking page:  http://localhost:${port}/book/goldie-test-salon
   (Press Ctrl+C here to stop.)
`);
console.log("▶ Starting the app");
// Ctrl+C reaches the app and the database together; wait for the app, then make sure the database stops.
process.on("SIGINT", () => {});
spawnSync("npx", ["next", "dev", "-p", port], { cwd: web, stdio: "inherit", env, shell: process.platform === "win32" });
await stopDb().catch(() => {});
