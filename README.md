# Goldie Test App

A test clone of [Goldie](https://heygoldie.com), the appointment-booking app for beauty professionals: services, clients, a calendar, a public booking page, reminders and reports.

## Layout

| Path | What |
| --- | --- |
| `apps/web` | Next.js 16 web app and JSON API (TypeScript, Prisma, SQLite) |
| `apps/mobile` | Mobile client (planned, Phase 6) |

## Run it on your computer

Needs [Node.js 22+](https://nodejs.org) and Git.

```bash
git clone https://github.com/Sunwaves/TEST---APP.git
cd TEST---APP
git checkout claude/ecstatic-allen-4xhlji
npm start
```

`npm start` installs everything, creates the database, adds a demo salon on first run and starts the app. Then open:

- Dashboard: http://localhost:3000/dashboard (demo login: `demo@goldie.test` / `demo1234`, or create your own salon at `/signup`)
- Booking page: http://localhost:3000/book/goldie-test-salon

To update later: `git pull`, then `npm start` again (your data is kept). To reset the demo data: `npm run reset-demo`.

### For developers

In `apps/web`: `npm run dev`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run db:migrate` (create a migration after editing the schema). CI runs lint, typecheck, tests and build on every push.

## Dashboard (`/dashboard`)

- **Calendar**: day and week views in the business timezone, opening hours shaded, overlapping bookings side by side, expected revenue for the range.
- **Appointments**: book with suggested free slots (or any time), existing or new client; mark completed / no-show / cancelled, restore, reschedule, notes.
- **Clients**: search, add, edit, visit history, total spent, no-shows.
- **Services**: add, edit price/duration/buffer, hide from booking.
- **Settings**: business name, timezone, slot interval, minimum notice, weekly opening hours with breaks.

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. CI runs all four on every push.

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: data model, booking rules (slots, buffers, min notice, timezones, no double-booking), JSON API, seed data, tests, CI | Done |
| 2 | Pro dashboard: day/week calendar, create/move/cancel appointments, clients, services, opening hours | Done |
| 3 | Public booking page `/book/<slug>`: pick service, date, slot; client details; confirmation and cancel link | Done |
| 4 | Logins and separate salons, confirmations/reminders/alerts (simulated, Resend/Twilio-ready), reports | Done |
| 5 | End-to-end tests (Playwright), Postgres, deployment | Next |
| 6 | Mobile app (Expo/React Native) using the same API | |

## Accounts

- `/signup` creates an owner account and a new salon (own services, clients, calendar and booking page). `/login`, log out, and `/forgot-password` with a one-hour reset link.
- Sessions are database-backed: an httpOnly cookie for the browser, or `POST /api/auth/login` → `Authorization: Bearer <token>` for API clients.
- Every staff page, server action and staff API route checks the session and only touches that salon's data.

## Messages

Clients get a confirmation, a reminder (default 24 h before), and notices when an appointment is moved or cancelled, by email and/or SMS depending on the contact details they gave. The salon gets an email alert for new online bookings and client cancellations. Templates and reminder timing are editable in Settings.

Sending is **simulated** by default: every message is recorded in **Dashboard → Messages** exactly as it would be sent. Real sending turns on per channel with environment variables (see `apps/web/.env.example`): Resend for email, Twilio for SMS. Reminders are delivered by a one-minute timer on a long-running server, or by `GET /api/cron/messages` with `CRON_SECRET` on serverless hosts.

## Reports

`/dashboard/reports`: revenue (completed appointments), still-booked value, no-show rate, new vs returning clients, revenue per day/week, appointments by status and source, top services and top clients, for any date range.

## Online booking (`/book/<slug>`)

Demo salon: `/book/goldie-test-salon`. Clients pick a service, a day and a free time, then leave their name and an email or phone number.

- After booking they land on a private page (`/booking/<token>`) to view the booking, add it to their calendar (.ics) or cancel it (until it starts).
- Returning clients are matched by email, then phone, so their history stays in one client record.
- Online bookings show an **Online** tag on the staff calendar.
- Settings control how far ahead clients can book and the address and phone shown on the page.
- The same flow is available as a public JSON API under `/api/public/…` for the mobile app.

## Booking rules

- Opening hours are stored per weekday in the business timezone; split shifts are supported.
- A slot fits when the service **plus its buffer** fits inside one opening window, starts on the slot grid (`slotStepMinutes`), respects `minNoticeMinutes`, and does not overlap a booked or completed appointment.
- Online bookings must land on an advertised slot inside the booking window (`maxAdvanceDays`). Staff bookings may be placed anywhere (including outside hours) as long as they don't overlap.
- Cancelled and no-show appointments free their time; reinstating one is refused if the slot has since been taken.
