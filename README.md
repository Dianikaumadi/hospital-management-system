# CarePoint — Hospital Management System

A full-stack hospital management platform for managing patients, doctors, appointments, clinical
records, laboratory tests, pharmacy stock, billing and staff, with role-based access control for
every department.

![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Playwright](https://img.shields.io/badge/Tested_with-Playwright-2EAD33?logo=playwright&logoColor=white)

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Available scripts](#available-scripts)
- [Roles and permissions](#roles-and-permissions)
- [API reference](#api-reference)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Authentication** — JWT-based login, password hashing with bcrypt, configurable token lifetime.
- **Invitation-based onboarding** — admins invite staff by email; invitees set their own password
  through a one-time link. Anonymous self-registration is disabled.
- **User management** — admins list users and activate/deactivate accounts.
- **Role-based access control** — seven roles (Admin, Doctor, Nurse, Receptionist, Laboratory Staff,
  Pharmacist, Accountant) with per-module write permissions.
- **Clinical modules**
  - Patients (with document uploads)
  - Doctors
  - Appointments
  - Medical records
  - Laboratory tests
  - Pharmacy / medicine inventory
  - Billing / invoices
  - Staff
- **Dashboard** — summary statistics and reports for Admin, Accountant and Doctor roles.
- **Search and pagination** on list endpoints.
- **Hardening** — request validation, rate limiting, strict CORS allow-list, central error handling.
- **End-to-end test suite** — 268 Playwright tests covering every module and the RBAC matrix, run in CI.

## Tech stack

| Layer      | Technology                                                                 |
| ---------- | -------------------------------------------------------------------------- |
| Frontend   | React 18, TypeScript, Vite, React Router, Tailwind CSS, Axios, lucide-react |
| Backend    | Node.js 22, Express 4, TypeScript, Sequelize 6, express-validator, Multer, Nodemailer |
| Database   | PostgreSQL (local, Docker, or [Neon](https://neon.tech))                    |
| Testing    | Vitest + Supertest (API), Playwright (end-to-end)                           |
| CI / CD    | GitHub Actions, Render (API), Vercel (frontend)                             |

## Architecture

```text
┌──────────────────────┐   HTTPS / JSON   ┌───────────────────────┐   SQL (TLS)   ┌──────────────┐
│  React SPA (Vite)    │ ───────────────▶ │  Express REST API     │ ────────────▶ │  PostgreSQL  │
│  frontend/ · Vercel  │  Bearer JWT      │  backend/ · Render    │   Sequelize   │  Neon / local│
└──────────────────────┘                  └───────────────────────┘               └──────────────┘
                                                     │ SMTP (optional)
                                                     ▼
                                              Invitation emails
```

The project is an npm **workspaces** monorepo: `backend`, `frontend` and `e2e` share a single
`node_modules` and lockfile at the root.

## Project structure

```text
hospital-management-system/
├── backend/                 Express + TypeScript REST API
│   ├── src/
│   │   ├── config/          Environment and database configuration
│   │   ├── controllers/     Route handlers (auth, generic resource CRUD, reports)
│   │   ├── middleware/      Auth, validation, uploads, error handling
│   │   ├── models/          Sequelize models and associations
│   │   ├── routes/          REST route definitions
│   │   ├── scripts/         One-off scripts (create-admin)
│   │   ├── services/        Email service
│   │   ├── types/           Shared types (roles, auth)
│   │   ├── app.ts           Express application
│   │   └── server.ts        Entry point
│   ├── tests/               Vitest API tests
│   └── uploads/             Uploaded patient documents (local)
├── frontend/                React + Vite single-page app
│   └── src/
│       ├── components/      Reusable UI components
│       ├── context/         Auth context
│       ├── layouts/         Authenticated dashboard shell
│       ├── pages/           Login, dashboard, module and user-management pages
│       ├── services/        Axios API client
│       └── App.tsx          Routes
├── database/
│   └── schema.sql           SQL schema reference
├── e2e/                     Playwright end-to-end suite (see e2e/README.md)
├── .github/workflows/       CI pipeline (e2e.yml)
├── render.yaml              Render Blueprint for the API
├── DEPLOYMENT.md            Step-by-step production deployment guide
└── package.json             Workspace root and shared scripts
```

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) **22** or later and npm
- A PostgreSQL database — local install, Docker, or a free [Neon](https://neon.tech) project

### 1. Clone and install

```bash
git clone https://github.com/Dianikaumadi/hospital-management-system.git
cd hospital-management-system
npm install
```

### 2. Create a database

**Option A — Docker (local PostgreSQL):**

```bash
docker run -d --name hms-db -p 5432:5432 \
  -e POSTGRES_USER=hms -e POSTGRES_PASSWORD=hms -e POSTGRES_DB=hospital_management \
  postgres:16
```

**Option B — Neon:** create a project and copy the **pooled** connection string from
**Connect → Node.js**.

Tables are created automatically on first start (`sequelize.sync()`); `database/schema.sql` is
provided as a reference.

### 3. Configure environment variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` and set at least `DATABASE_URL` and `JWT_SECRET`. For a local database, also
set `DATABASE_SSL=false`:

```env
DATABASE_URL=postgresql://hms:hms@localhost:5432/hospital_management
DATABASE_SSL=false
JWT_SECRET=<a long random string>
```

### 4. Create the first administrator

Self-registration is disabled, so seed the first admin with the bootstrap script:

```bash
# bash / macOS / Linux
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='ChangeMe123!' npm run create-admin --workspace backend
```

```powershell
# PowerShell
$env:ADMIN_EMAIL='admin@example.com'; $env:ADMIN_PASSWORD='ChangeMe123!'; npm run create-admin --workspace backend
```

Optional: `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`. The script does nothing if the email already exists.

#### Optional: load demo data

For local development and demos, fill the database with fictitious doctors, staff, patients,
appointments, medical records, lab tests, invoices and pharmacy stock:

```bash
npm run seed --workspace backend                     # demo users' password defaults to Demo@12345
SEED_PASSWORD='Another#Pass1' npm run seed --workspace backend
SEED_RESET=true npm run seed --workspace backend     # remove previous demo data and reseed
```

All demo records use the `DEMO-` prefix and `@carepoint.test` emails (for example
`anita.desai@carepoint.test`), so they are easy to identify. The script refuses to run when
`NODE_ENV=production` unless `SEED_ALLOW_PRODUCTION=true` is set. Never load demo data into a
database that holds real patient information.

### 5. Run the app

```bash
npm run dev
```

| Service      | URL                            |
| ------------ | ------------------------------ |
| Frontend     | http://localhost:5173          |
| API          | http://localhost:4000/api      |
| Health check | http://localhost:4000/health   |

Sign in with the admin account, then invite other staff from **User management**.

## Environment variables

### Backend (`backend/.env`)

| Variable                   | Required | Default                 | Description |
| -------------------------- | :------: | ----------------------- | ----------- |
| `DATABASE_URL`             | ✅       | —                       | PostgreSQL connection string |
| `JWT_SECRET`               | ✅       | —                       | Secret used to sign JWTs (use 32+ random bytes) |
| `NODE_ENV`                 |          | `development`           | `development` or `production` |
| `PORT`                     |          | `4000`                  | API port |
| `DATABASE_SSL`             |          | auto                    | Enable TLS; automatically on for Neon hosts and in production |
| `JWT_EXPIRES_IN`           |          | `8h`                    | Token lifetime |
| `CLIENT_URL`               |          | `http://localhost:5173` | Allowed frontend origin(s), comma-separated. The first is used in email links |
| `INVITATION_EXPIRES_HOURS` |          | `72`                    | Invitation link validity |
| `RATE_LIMIT_MAX`           |          | `300` in production     | Requests per 15 minutes per IP |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | | — | SMTP settings for invitation emails. If unset, invitations are created but not emailed |

### Frontend (`frontend/.env`)

| Variable       | Required | Description |
| -------------- | :------: | ----------- |
| `VITE_API_URL` | ✅       | Base URL of the API, e.g. `http://localhost:4000/api`. Baked in at build time |

## Available scripts

Run from the repository root:

| Command                   | Description |
| ------------------------- | ----------- |
| `npm run dev`             | Start the API and frontend together in watch mode |
| `npm run build`           | Build the backend (`tsc`) and frontend (`vite build`) |
| `npm test`                | Run the backend Vitest suite |
| `npm run test:e2e`        | Run the Playwright end-to-end suite |
| `npm run test:e2e:report` | Open the last Playwright HTML report |

Workspace-specific:

| Command                                          | Description |
| ------------------------------------------------ | ----------- |
| `npm start --workspace backend`                  | Run the compiled API (`dist/server.js`) |
| `npm run create-admin --workspace backend`       | Create the first administrator |
| `npm run seed --workspace backend`               | Load fictitious demo data |
| `npm run preview --workspace frontend`           | Preview the production frontend build |
| `npm run test:smoke --workspace e2e`             | Run only `@smoke` tests |
| `npm run test:ui --workspace e2e`                | Open Playwright UI mode |

## Roles and permissions

All authenticated users can **read** every module. **Create / update** is restricted as follows:

| Module            | Admin | Doctor | Nurse | Receptionist | Lab Staff | Pharmacist | Accountant |
| ----------------- | :---: | :----: | :---: | :----------: | :-------: | :--------: | :--------: |
| Patients          | ✅    | ✅     | ✅    | ✅           |           |            |            |
| Patient documents | ✅    | ✅     | ✅    | ✅           |           |            |            |
| Doctors           | ✅    |        |       | ✅           |           |            |            |
| Appointments      | ✅    | ✅     | ✅    | ✅           |           |            |            |
| Medical records   | ✅    | ✅     | ✅    |              |           |            |            |
| Laboratory tests  | ✅    | ✅     | ✅    |              | ✅        |            |            |
| Pharmacy          | ✅    |        |       |              |           | ✅         |            |
| Billing           | ✅    |        |       | ✅           |           |            | ✅         |
| Staff             | ✅    |        |       |              |           |            |            |
| Dashboard reports | ✅    | ✅     |       |              |           |            | ✅         |
| User management   | ✅    |        |       |              |           |            |            |

## API reference

Base URL: `/api`. Protected endpoints require `Authorization: Bearer <token>`.

All responses use a common envelope:

```json
{ "success": true, "data": { }, "meta": { "total": 0 } }
```

### Authentication and users

| Method  | Endpoint                               | Access | Description |
| ------- | -------------------------------------- | ------ | ----------- |
| `POST`  | `/auth/login`                          | Public | Log in, returns a JWT |
| `GET`   | `/auth/me`                             | Auth   | Current user profile |
| `GET`   | `/auth/invitations/:token`             | Public | Inspect an invitation |
| `POST`  | `/auth/invitations/:token/activate`    | Public | Set a password and activate the account |
| `POST`  | `/auth/register`                       | Admin  | Create a user directly |
| `GET`   | `/users`                               | Admin  | List users |
| `POST`  | `/users/invitations`                   | Admin  | Invite a staff member by email |
| `PATCH` | `/users/:id/status`                    | Admin  | Activate or deactivate a user (`{ "isActive": false }`) |

### Resources

Each resource exposes the same four operations:

| Method  | Endpoint           | Description |
| ------- | ------------------ | ----------- |
| `GET`   | `/<resource>`      | List (newest first). Query: `limit` (default 50, max 100), `search` where supported |
| `POST`  | `/<resource>`      | Create |
| `GET`   | `/<resource>/:id`  | Get one |
| `PATCH` | `/<resource>/:id`  | Update |

| Resource         | Path                   | `search` matches        |
| ---------------- | ---------------------- | ----------------------- |
| Patients         | `/patients`            | `medicalRecordNumber`   |
| Doctors          | `/doctors`             | `department`            |
| Appointments     | `/appointments`        | —                       |
| Medical records  | `/medical-records`     | —                       |
| Laboratory tests | `/laboratory/tests`    | —                       |
| Medicines        | `/pharmacy/medicines`  | `name`, `sku`           |
| Invoices         | `/billing/invoices`    | —                       |
| Staff            | `/staff`               | —                       |

### Other

| Method | Endpoint                   | Access                   | Description |
| ------ | -------------------------- | ------------------------ | ----------- |
| `POST` | `/patients/:id/documents`  | Admin, Doctor, Nurse, Receptionist | Upload a patient document (`multipart/form-data`) |
| `GET`  | `/reports/dashboard`       | Admin, Accountant, Doctor | Dashboard statistics |
| `GET`  | `/health` (no `/api` prefix) | Public                 | Health check |

## Testing

### Backend unit / integration tests

```bash
npm test
```

### End-to-end tests

A Playwright + TypeScript suite using the Page Object Model, with **268 tests** across auth, RBAC,
user management, patients, doctors, appointments, medical records, laboratory, pharmacy, billing
and the dashboard.

```bash
cp e2e/.env.example e2e/.env
npm run install:browsers --workspace e2e   # first run only
npm run test:e2e
npm run test:e2e:report
```

> ⚠️ Use a **disposable database** — the suite creates users and data.

See [e2e/README.md](e2e/README.md) for configuration, tags and folder layout.

### Continuous integration

[.github/workflows/e2e.yml](.github/workflows/e2e.yml) runs the full end-to-end suite against a
PostgreSQL 16 service container on every push to `main`, on pull requests, and on manual dispatch.

## Deployment

The recommended free-tier setup is **Neon** (database) + **Render** (API) + **Vercel** (frontend):

1. Create a Neon database and copy its pooled connection string.
2. Deploy the API to Render with the included [render.yaml](render.yaml) Blueprint.
3. Deploy `frontend/` to Vercel with `VITE_API_URL` pointing at the Render API.
4. Set `CLIENT_URL` on Render to the Vercel origin.
5. Create the first administrator with `npm run create-admin`.

Full instructions and free-tier limitations are in [DEPLOYMENT.md](DEPLOYMENT.md).

## Security

- Passwords are hashed with bcrypt; invitation tokens are stored only as SHA-256 hashes.
- Anonymous registration is disabled; accounts are created by admins or via invitation.
- CORS only allows the origins listed in `CLIENT_URL`.
- Requests are rate limited and validated with `express-validator`.
- Never commit `.env` files or database connection strings.

If you discover a vulnerability, please open a private report rather than a public issue.

## Contributing

1. Fork the repository and create a feature branch: `git checkout -b feature/my-change`
2. Make your changes and add tests where appropriate.
3. Run `npm run build`, `npm test` and `npm run test:e2e`.
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:` …).
5. Open a pull request against `main`.

## License

No license has been specified yet. All rights reserved by the author until a license is added.
