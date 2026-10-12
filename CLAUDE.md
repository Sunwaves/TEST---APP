# BookMe: notes for Claude

Appointment booking for beauty salons (inspired by Goldie). Owner: Marius (non-developer). Explain things in plain language,
test changes in the real app (browser), and commit + push to the work branch when done.

## Where things are

- `apps/web`: the whole app. Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, Prisma 6 + Postgres, TypeScript.
  **Next.js 16 differs from older versions**: read `apps/web/node_modules/next/dist/docs/` before using an API (see `apps/web/AGENTS.md`).
- `README.md`: features and rules. `DEPLOY.md`: Vercel + Neon + Stripe setup, written for the owner.
- Work branch: `claude/ecstatic-allen-4xhlji` (the repo's default and only branch; there is no `main` yet).

Key code (all under `apps/web/src`):
| Area | Files |
|---|---|
| Booking rules (slots, clashes, reschedule, cancel) | `lib/availability.ts`, `lib/booking.ts` |
| Plans: Free 20 bookings/month, PRO 150 RON/month incl. VAT, 14-day trial | `lib/plans.ts`, `lib/stripe.ts`, `app/dashboard/billing*`, `app/api/stripe/webhook` |
| Logins, sessions, rate limits | `lib/auth.ts`, `lib/session.ts`, `lib/rate-limit.ts`, `lib/limits.ts`, `app/(auth)` |
| Messages (simulated email/SMS, reminders) | `lib/messages/*`, `app/api/cron/messages` |
| Salon page (social-profile style), photos | `app/book/[slug]`, `components/salon-*.tsx`, `lib/images.ts` |
| Staff dashboard | `app/dashboard/**`, server actions in `app/dashboard/actions.ts` |
| Money (RON, "1.234,50 RON") and theme (light/dark cookie) | `lib/format.ts`, `lib/theme.ts`, `app/globals.css` |

Every staff page/action/API goes through `currentBusiness()` / `dashboardBusiness()` (login check + salon scoping).
Expected errors are `BookingError` (`lib/errors.ts`) with an HTTP status.

## Commands

- Run locally: `npm start` (repo root): installs, starts a private Postgres (embedded-postgres, port 54329), migrates, seeds once, runs `next dev` on :3000.
  Demo login `demo@goldie.test` / `demo1234`, booking page `/book/goldie-test-salon`. `npm run reset-demo` reseeds.
- In `apps/web`: `npm run lint`, `npm run typecheck`, `npm test` (vitest, throwaway `goldie_test` DB), `npm run test:e2e` (build + Playwright).
  In Claude's cloud sandbox use `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- Free PRO for a salon: `npm run give-pro -- <email|slug> <days|off>`.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, migrations, build, browser tests on every push.

## Gotchas learned the hard way

- New migration: Prisma refuses `migrate reset`/`--force-reset` when run by an AI. Generate SQL with
  `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <throwaway *_test db> --script`
  into a new `prisma/migrations/<timestamp>_<name>/migration.sql`, then `prisma migrate deploy`.
- The cloud sandbox runs as root; `scripts/local-db.mjs` hands `.pgdata` to the `postgres` user. Its folder must be readable by that user (not the scratchpad).
- Stop servers by process name, not with `pkill -f` patterns that match your own shell. A stale `next start` on a port serves an old build.
- Forms submit via `submitKeepingValues` (`components/action-form.tsx`) so typed values survive server errors.
- Dark mode remaps the Tailwind palette in `globals.css` (`@layer base`); base colours must stay inside that layer.
- Grid children that hold wide content need `min-w-0` or phones get sideways scroll (browser tests check this).
- Seeded history is backdated (`createdAt`) so the demo salon starts under the free limit.

## Decisions so far

Name **BookMe**; currency **RON**; SMS and no-branding are PRO-only; online booking pauses at 20/month (staff get 3 extra);
email/SMS stay simulated until the owner has a domain (Resend/Twilio env vars ready); hosting plan: Vercel Pro + Neon.

## Open ideas / next steps

- Owner still has to deploy (DEPLOY.md) and set up Stripe; possibly create a `main` branch as the production branch.
- Default timezone for new salons is Europe/London: consider Europe/Bucharest.
- Not built: yearly plan, e-Factura invoicing, staff accounts/calendars, deposits, waitlist, drag-and-drop calendar,
  photo cropping UI, service photos, mobile app (Phase 6, API is ready incl. Bearer-token login).
