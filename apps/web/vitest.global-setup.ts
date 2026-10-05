import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

// Give integration tests a fresh SQLite database with the current schema.
// SQLite paths resolve relative to prisma/schema.prisma.
export default function setup() {
  for (const suffix of ["", "-journal"]) rmSync(`prisma/test.db${suffix}`, { force: true });
  execSync("npx prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "inherit",
  });
}
