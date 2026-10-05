# @goldie/web

Next.js app and JSON API for the Goldie test app. See the [root README](../../README.md) for setup and the roadmap.

- `prisma/schema.prisma` — data model
- `src/lib/availability.ts` — pure slot calculation
- `src/lib/booking.ts` — booking, conflict checks, status changes
- `src/app/api/**` — route handlers (used by the dashboard, booking page and future mobile app)

Until auth arrives (Phase 4), the API acts on the first business in the database.
