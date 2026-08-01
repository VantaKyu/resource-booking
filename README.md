# MMCM Resource Booking

A campus resource booking system for **MMCM** that lets students, teachers, and staff request vehicles, facilities, and equipment, while admins/staff manage inventory and approve booking lifecycles from a dedicated admin panel.

## Overview

The app is split into two parts:

- **Public site** (`/`) — browse available vehicles, facilities, and equipment; search/filter by type; submit a booking request with requester name, role, time window, and purpose. Booking status is tracked through `REQUEST → ONGOING → SUCCESS/CANCEL`.
- **Admin panel** (`/admin`) — session-authenticated area (login-gated) for managing the resource catalog (create/edit/soft-delete/hard-delete), approving/starting/finishing/cancelling bookings, and viewing a booking-demand forecast (busy/normal/quiet day predictions) rendered as charts.

Booking creation is protected against double-booking: the API rejects any request whose time window overlaps an existing `REQUEST`/`ONGOING` booking for the same resource, and the client also runs a local overlap pre-check before submitting.

## Tech Stack

**Frontend** (`/`)
- React 19 + TypeScript, built with Vite 7
- React Router 7 for routing (`/`, `/admin`, `/admin/resources`)
- Tailwind CSS 4 for styling, with shadcn/ui-style primitives on top of Radix UI (`dialog`, `select`, `tabs`, `label`, `slot`)
- Framer Motion for UI animation, Lucide for icons, Sonner for toasts
- Recharts for the admin analytics/forecast charts
- A local exponential-moving-average forecasting module (`src/lib/forecast.ts`) as a client-side fallback when the analytics API is unavailable

**Backend** (`Backers/`)
- Node.js + Express (ESM)
- PostgreSQL via `pg`, with schema bootstrap (tables, indexes, and seed data) run automatically on server start (`db.js`)
- `express-session` with `connect-pg-simple` for cookie-based session auth (Postgres-backed session store)
- `bcryptjs` for admin password hashing
- CORS configured for credentialed cross-origin requests from the Vite dev server

**Infrastructure**
- Dockerfile for the API + `docker-compose.yml` bundling the API, a Postgres 16 container, and Adminer (DB UI) for local development

## Data Model

- **resources** — `kind` (`VEHICLE` / `FACILITY` / `EQUIPMENT`), name, subcategory, type, quantity, status (`Available` / `Maintenance` / `Inactive`)
- **bookings** — linked to a resource, with start/end timestamps, requester name/role, purpose, and status (`REQUEST` / `ONGOING` / `SUCCESS` / `CANCEL`) plus timestamps for each transition
- **admin_users** — `ADMIN` / `STAFF` roles, bcrypt-hashed passwords
- **session** — Postgres-backed express-session store

## Getting Started

This is the workflow to actually use — backend runs fully in Docker, frontend runs locally via Vite.

### Backend (Docker — db + api + adminer)

```bash
cd Backers
docker compose up -d --build
```

This starts three containers:
- `mmcm_db` — Postgres 16 (creates all tables and seeds the resource catalog plus a default admin account `admin` / `admin123` on first boot — change this immediately in production)
- `mmcm_api` — the Express API on `http://localhost:5174`
- `mmcm_adminer` — DB browser UI on `http://localhost:8080`

Check it's healthy: `curl http://localhost:5174/api/health` should return `{"ok":true}`.

Stop with `docker compose down` (this keeps the `backers_dbdata` volume, so your data survives restarts). Only add `-v` if you actually want to wipe the database.

### Frontend (local — Vite)

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173` and talks to the API at `http://localhost:5174` by default. Set `VITE_API_BASE` if the API is running somewhere else.

### Gotcha: port 5432 conflicts with a local Postgres install

`Backers/db.js` and `.env` assume the API connects to Postgres via `localhost:5432`. That's correct for the **containerized** API (`PGHOST` is overridden to `db` inside `docker-compose.yml`, so it talks to the `mmcm_db` container over Docker's internal network and never touches the host's port 5432 at all).

It only becomes a problem if you try to run the API directly on the host (`npm start` inside `Backers/` instead of via Docker) *and* you also have a native Postgres service already listening on `localhost:5432` — Windows will happily let both bind the port, but it's ambiguous which one actually receives the connection, so auth can fail unpredictably. If you need to run the API on the host, remap the db container's host port (e.g. `5433:5432` via a compose override) and point `PGPORT` at that instead. Otherwise, just use `docker compose up -d --build` and this never comes up.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build |
