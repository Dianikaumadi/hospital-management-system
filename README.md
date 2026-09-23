# Hospital Management System

Production-oriented starter implementation for a hospital management platform.

## Structure

```text
backend/
  src/
    config/       Environment and database setup
    controllers/  HTTP handlers
    middleware/   Authentication and errors
    models/       Sequelize entities and associations
    routes/       REST endpoints
    types/        Shared backend types
    app.ts        Express application
    server.ts     Runtime entry point
frontend/
  src/
    components/   Reusable UI
    layouts/      Authenticated shell
    pages/        Dashboard and module pages
    services/     Axios API client
    types/        Client types
    App.tsx       Routes
database/
  migrations/    SQL bootstrap/schema reference
```

## Quick start

1. Create a local PostgreSQL database, or create a Neon project and copy its pooled
   connection string from **Connect > Node.js**.
2. Copy `backend/.env.example` to `backend/.env`, set `DATABASE_URL`, `DATABASE_SSL=true`,
   and set `JWT_SECRET`. Keep the Neon connection string private.
3. Install dependencies: `npm install`.
4. Start API and UI: `npm run dev`.

The API is available at `http://localhost:4000/api`, and the UI at `http://localhost:5173`.

### Neon

Neon works without code changes because it speaks PostgreSQL. Use the pooled Neon connection
string for the running API and keep `?sslmode=verify-full` in the URL. The backend enables TLS
automatically when it detects a Neon host or `DATABASE_SSL=true`. For local PostgreSQL, use
`DATABASE_SSL=false`.

## API

Authentication: `POST /api/auth/login` and invitation activation endpoints
(`GET /api/auth/invitations/:token`, `POST /api/auth/invitations/:token/activate`).
`POST /api/auth/register` is admin-only and requires a Bearer token for an Admin. Staff should
normally be onboarded with `POST /api/users/invitations`, which returns a one-time token for
delivery by the configured email service (tokens expire after `INVITATION_EXPIRES_HOURS`, default
72 hours). Invitation tokens are stored only as SHA-256 hashes.
Admins can use `GET /api/users` and `PATCH /api/users/:id/status` to list or deactivate/reactivate
accounts. A deployment must seed its first administrator directly in the database or through a
one-time controlled bootstrap process; anonymous registration is intentionally disabled.
Protected resources include patients, doctors, appointments, medical records, laboratory tests,
medicines, invoices, staff, and reports. Send `Authorization: Bearer <token>`.


## End-to-end tests

A Playwright + TypeScript suite (Page Object Model, 229 tests across auth, RBAC, patients, doctors,
appointments, medical records, laboratory, pharmacy, billing and dashboard) lives in [`e2e/`](e2e/README.md).

```bash
npm run test:e2e          # run (backend + frontend must be running, see e2e/README.md)
npm run test:e2e:report   # open the HTML report
```

Use a disposable database - the suite creates users and data. CI: `.github/workflows/e2e.yml`.
