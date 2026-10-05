# @bookme/web

Next.js app and JSON API for BookMe. See the [root README](../../README.md) for setup and the roadmap.

- `prisma/schema.prisma` — data model
- `src/lib/availability.ts` — pure slot calculation
- `src/lib/booking.ts` — booking, conflict checks, status changes
- `src/app/api/**` — JSON route handlers (for the booking page and future mobile app)
- `src/app/dashboard/**` — staff dashboard pages; `actions.ts` holds its server actions
- `src/components/**` — shared UI (calendar grid, forms)
- `e2e/**` — Playwright browser tests (`npm run test:e2e`)
- `scripts/local.mjs` — what `npm start` runs; `scripts/local-db.mjs` — the private local Postgres

