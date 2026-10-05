# Goldie Test App

A test clone of [Goldie](https://heygoldie.com), the appointment-booking app for beauty professionals: services, clients, a calendar, a public booking page, reminders and reports.

## Layout

| Path | What |
| --- | --- |
| `apps/web` | Next.js 16 web app and JSON API (TypeScript, Prisma, SQLite) |
| `apps/mobile` | Mobile client (planned, Phase 6) |

## Quick start

```bash
cd apps/web
cp .env.example .env
npm install
npm run db:migrate   # create the SQLite database
npm run db:seed      # demo salon, services, clients, bookings
npm run dev          # http://localhost:3000 → Open dashboard
```

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
| 3 | Public booking page `/book/<slug>`: pick service, date, slot; client details; confirmation and cancel link | Next |
| 4 | Accounts and auth, reminders (email/SMS via a provider, stubbed in dev), basic reports | |
| 5 | End-to-end tests (Playwright), Postgres, deployment | |
| 6 | Mobile app (Expo/React Native) using the same API | |

## Booking rules

- Opening hours are stored per weekday in the business timezone; split shifts are supported.
- A slot fits when the service **plus its buffer** fits inside one opening window, starts on the slot grid (`slotStepMinutes`), respects `minNoticeMinutes`, and does not overlap a booked or completed appointment.
- Online bookings must land on an advertised slot. Staff bookings may be placed anywhere (including outside hours) as long as they don't overlap.
- Cancelled and no-show appointments free their time; reinstating one is refused if the slot has since been taken.
