# MMC Resource Booking — Backend (Node + TypeScript + Express + Prisma + PostgreSQL)

Dockerized backend API for your Vite/React frontend. Includes JWT auth, RBAC, resource & booking endpoints,
conflict checks, and Adminer for DB inspection.

## Quick Start (Docker)

1. Create `.env` from `.env.example` and adjust values if needed.
2. Build and run:
   ```bash
   docker compose up --build
   ```
3. Open Adminer at http://localhost:8081 (Server: `db`, User: `mmc_user`, Pass: `mmc_pass`, DB: `mmc_booking`).
4. After the API starts, run prisma deploy & seed inside the `api` container (if not auto-run):
   ```bash
   docker compose exec api npx prisma migrate deploy
   docker compose exec api npm run seed
   ```

## Local Dev (without Docker)
```bash
cp .env.example .env
npm install
npx prisma generate
npm run dev
# In another terminal:
docker compose up db adminer
```

## Endpoints

- `POST /auth/register` — { email, name, password, role? } -> token + user
- `POST /auth/login` — { email, password } -> token + user
- `GET /users/me` — requires Bearer token
- `GET /users` — ADMIN/STAFF only
- `GET /resources` — list all
- `POST /resources` — ADMIN/STAFF only
- `PATCH /resources/:id` — ADMIN/STAFF only
- `GET /bookings?userId=&resourceId=&status=` — list (auth required)
- `POST /bookings` — create (auth required); checks conflicts (time window + qty)
- `PATCH /bookings/:id/status` — ADMIN/STAFF set status
- `POST /bookings/:id/cancel` — owner or ADMIN/STAFF

### Auth
All protected routes use `Authorization: Bearer <token>`.
Seeded admin: `admin@mmc.local` / `admin123`

## Notes / Enhancements
- Uses service-level conflict detection; for stronger guarantees, add a PostgreSQL `EXCLUDE` constraint on time ranges.
- Consider rate-limiting, audit logs, email notifications, and soft deletes for production.
- Connect your frontend to these routes; base URL `http://localhost:8080` by default.
