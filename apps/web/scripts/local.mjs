// One-command local run: `npm start` from the repo root.
// Installs dependencies, creates .env and the database, adds demo data on first run,
// then starts the app. Safe to run again: it never wipes existing data.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT ?? "3000";

function run(command, args, label) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { cwd: web, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    console.error(`\n✖ ${label} failed. See the messages above.`);
    process.exit(result.status ?? 1);
  }
}

const [major] = process.versions.node.split(".").map(Number);
if (major < 20) {
  console.error(`✖ Node.js ${process.versions.node} is too old. Install Node.js 22 from https://nodejs.org and try again.`);
  process.exit(1);
}

if (!existsSync(join(web, ".env"))) {
  copyFileSync(join(web, ".env.example"), join(web, ".env"));
  console.log("▶ Created apps/web/.env");
}

run("npm", ["install", "--no-audit", "--no-fund"], "Installing dependencies (first time takes a minute)");
run("npx", ["prisma", "migrate", "deploy"], "Updating the database");

// Seed demo data only if the database has no business yet.
const check = spawnSync(
  process.execPath,
  ["-e", "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.business.count().then(n=>{console.log(n);return p.$disconnect()})"],
  { cwd: web, encoding: "utf8" },
);
if (check.stdout.trim() === "0") run("npx", ["prisma", "db", "seed"], "Adding demo salon data");

console.log(`
✔ Ready. Open these in your browser:
   Dashboard:     http://localhost:${port}/dashboard
   Booking page:  http://localhost:${port}/book/goldie-test-salon
   (Press Ctrl+C here to stop.)
`);
run("npx", ["next", "dev", "-p", port], "Starting the app");
