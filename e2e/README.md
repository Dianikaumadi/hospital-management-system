# Hospital Management System - E2E tests

Playwright + TypeScript end-to-end suite using the Page Object Model. It exercises the React UI and the
Express API together: UI flows are driven through the browser, and test data is created/verified through
Playwright's `APIRequestContext`, which keeps the suite fast and independent.

| | |
|---|---|
| Tests | 268, none skipped |
| Browser | Chromium (add more projects in `playwright.config.ts`) |
| Reports | HTML (`reports/html`), JUnit (`reports/junit/results.xml`) |
| On failure | screenshot, video, trace + console errors / 5xx log attached |

## Folder structure

```text
e2e/
├── playwright.config.ts        Reporters, timeouts, failure artifacts, optional webServer
├── global-setup.ts             Health checks, creates/logs in one account per role, writes auth state
├── global-teardown.ts          Sweeps e2e-* data from PostgreSQL (opt-in)
├── .env.example                All settings (copy to .env)
├── api/
│   ├── ApiClient.ts            APIRequestContext wrapper (typed helpers, ECONNRESET retry)
│   ├── endpoints.ts            REST paths
│   └── types.ts                Entity + envelope types
├── config/
│   ├── env.ts                  Typed environment configuration
│   └── paths.ts
├── fixtures/                   Reusable test data + the extended `test`
│   ├── index.ts                `test` with fixtures: api, data, pageAs, page objects, diagnostics
│   ├── test-data.ts            TestData factory (creates records via API, tracks them)
│   ├── users.ts                One account per role + storageState paths
│   ├── patients.ts  doctors.ts  appointments.ts  medical-records.ts
│   ├── lab-tests.ts medicines.ts invoices.ts staff.ts invitations.ts
│   ├── permissions.ts          Role -> module authorisation matrix (mirrors backend routes)
│   └── files/sample-report.txt Upload fixture
├── pages/                      Page objects
│   ├── BasePage.ts  components/AppShell.ts (sidebar, user badge, logout)
│   ├── LoginPage.ts RegisterPage.ts ActivateAccountPage.ts DashboardPage.ts UserManagementPage.ts
│   ├── ModuleListPage.ts       Generic list + search + "Add new" modal (base for the module pages)
│   └── PatientsPage.ts DoctorsPage.ts AppointmentsPage.ts MedicalRecordsPage.ts LaboratoryPage.ts PharmacyPage.ts BillingPage.ts
├── tests/
│   ├── auth/         login, logout, protected routes, self-registration (intentionally blocked)
│   ├── rbac/         role -> module access matrix, user management access
│   ├── users/        staff invitations, account activation, staff directory, deactivate/reactivate
│   ├── patients/     create, list, search, update, upload, details
│   ├── doctors/      create, update, department, specialization
│   ├── appointments/ booking + Scheduled/Completed/Cancelled/No-show
│   ├── medical-records/  diagnosis, treatment, prescription, report URL, history
│   ├── laboratory/   Requested -> Collected -> Processing -> Completed, results
│   ├── pharmacy/     create, stock, quantity, expiry
│   ├── billing/      invoices, items, totals, payment status
│   └── reports/      dashboard figures
├── utils/            random ids, dates, money, JWT decode, DB cleanup + admin bootstrap, session loader
└── scripts/cleanup.ts
```

## Prerequisites

- Node.js 22+
- The backend (`:4000`) and frontend (`:5173`) running against a **dedicated, disposable PostgreSQL
  database** (see [Safety](#safety-read-this-first))
- `E2E_DATABASE_URL` set to that same database **the first time you run against an empty one** - the
  backend has no anonymous sign-up, so nothing can create the very first Admin account except a direct
  database insert (see [How it works](#how-it-works)). Once an admin account exists, subsequent runs
  work without it.

## Setup

```bash
npm install                      # from the repo root (e2e is an npm workspace)
npx playwright install chromium  # or: npm run install:browsers --workspace e2e
cp e2e/.env.example e2e/.env     # optional - defaults work for a local setup
```

## Running

Start the app under test, pointed at a **disposable database** (see Safety):

```bash
npm run dev          # from the repo root: backend :4000 + frontend :5173
```

The API rate limiter defaults to 300 requests / 15 min only when `NODE_ENV=production`; in development it is
effectively off, so nothing extra is needed. If you set `RATE_LIMIT_MAX` yourself it must be >= 2000 or
`global-setup` refuses to start (a full run makes ~800 API calls).

Then, from `e2e/` (or use the `test:e2e` / `test:e2e:report` aliases from the repo root):

| Command | What it does |
|---|---|
| `npm run test` | Run everything |
| `npm run test:report` | Open the HTML report |
| `npm run test:smoke` | Only `@smoke` tests |
| `npm run test:api` | Only API-level tests (`@api`) - no browser interaction |
| `npm run test:headed` / `test:ui` / `test:debug` | Watch, UI mode, inspector |
| `npm run test:failed` | Re-run last failures |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run cleanup` | Manually delete leftover `e2e-*` data |

Single file / test: `npx playwright test tests/patients -g "searches"`.

Let Playwright start the servers itself with `E2E_START_SERVERS=true` (the backend then needs its normal
environment variables: `DATABASE_URL`, `JWT_SECRET`, ...). This is what CI does.

## Configuration (`e2e/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:5173` | Frontend |
| `E2E_API_URL` | `http://localhost:4000` | Backend (`/api` is appended) |
| `E2E_USER_PASSWORD` | `E2eTest#2026` | Password of the generated role accounts |
| `E2E_EMAIL_DOMAIN` | `hms-e2e.test` | Accounts are `e2e.<role>@hms-e2e.test` |
| `E2E_START_SERVERS` | `false` (`true` in CI) | Start backend + frontend via Playwright |
| `E2E_DATABASE_URL` | empty | Bootstraps the first Admin on an empty database, and enables data cleanup (same DB the backend uses) |
| `E2E_DATABASE_SSL` | `false` | TLS for cleanup connection |
| `E2E_ALLOW_REMOTE_DB` | `false` | Allow running (and cleaning up) against a non-local database |
| `E2E_CLEANUP` | `end` | `end` = sweep after the run, `test` = also after each test, `off` |

## How it works

**Accounts.** The backend has no anonymous sign-up: `POST /api/auth/register` requires an Admin bearer
token, full stop (see backend/README.md - "anonymous registration is intentionally disabled"). So
`global-setup` bootstraps like a real deployment would:

1. Try to log in as the Admin (`e2e.admin@hms-e2e.test`). If that account already exists, done.
2. Otherwise, insert it **directly into the database** (`utils/db.ts#seedAdminUser`, bcrypt-hashed the
   same way the backend does) - this needs `E2E_DATABASE_URL` - then log in normally so the token comes
   from the real login endpoint.
3. Log in (or, on a fresh database, register with the admin's token) the other five role accounts -
   Doctor, Receptionist, Laboratory Staff, Pharmacist, Accountant - plus one doctor profile.

It stores the JWTs and a browser `storageState` per role in `.auth/`. UI tests start already signed in
with `test.use({ storageState: storageStatePath('receptionist') })`; only the login/logout/registration
specs use the real login form. No test spends its time (or rate-limit budget) logging in.

**Staff onboarding beyond the six fixed accounts** goes through the real invitation flow, exactly as an
Admin would use it: `POST /users/invitations` returns a one-time token (email delivery is skipped - SMTP
isn't configured for the test run, so `emailSent` is `false`), which is then redeemed with
`POST /auth/invitations/:token/activate`. See `tests/users/user-management.spec.ts` and
`data.invitation()`. The public "Create account" page (`/register`) is a dead end by design - see
`tests/auth/registration.spec.ts`.

**Test data.** Tests never depend on pre-existing data. The `data` fixture creates records through the API with
unique `e2e-` prefixed identifiers:

```ts
test('...', async ({ data, api, appointmentsPage }) => {
  const patient = await data.patient();                       // API call as receptionist
  const appt = await data.appointment({ patientId: patient.id });
  await api.doctor.patchData(`appointments/${appt.id}`, { status: 'Completed' });
  await appointmentsPage.open();                              // UI verifies what the API changed
  await appointmentsPage.expectRow(appt.id, { status: 'Completed' });
});
```

**Hooks.** `beforeEach` opens the page under test; `afterEach` calls `data.finish(testInfo)`, which attaches the
list of records the test created to the report and (with `E2E_CLEANUP=test`) deletes them.

**Cleanup.** The API has no DELETE endpoints, so cleanup uses SQL against PostgreSQL and is therefore opt-in.
Set `E2E_DATABASE_URL`; after the run `global-teardown` removes only rows carrying the e2e markers
(`e2e-` MRNs/licences/SKUs/invoice numbers, `@hms-e2e.test` users) in foreign-key-safe order.
Uploaded files stay in `backend/uploads/` (git-ignored).

**Dashboard counters** are global, so `reports/dashboard.spec.ts` asserts
`API before <= UI <= API after` and `>= before + N` instead of exact values; that stays correct under parallel
workers. It is tagged `@counts` and must not run with `E2E_CLEANUP=test` in parallel.

**Selectors.** Everything is located by `data-testid` (`getByTestId`) - see the attributes in
`frontend/src/pages/*.tsx`, `layouts/DashboardLayout.tsx` and `components/StatCard.tsx`. Waits are
condition-based: `waitForResponse` on the exact API call plus `networkidle` after navigation, and web-first
`expect` assertions. There are no fixed sleeps.

## Role access matrix

Reads (`GET`) are open to any authenticated user; writes are role-gated (`fixtures/permissions.ts`,
mirrors `backend/src/routes/index.ts`). `rbac/role-access.spec.ts` generates one API test per role x module
(PATCH on a non-existent id: `404` = authorised, `403` = denied, so no data is created), plus UI navigation
tests per role and UI checks that a denied action shows the permission error.

| Module | Admin | Doctor | Receptionist | Laboratory | Pharmacist | Accountant |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Patients | W | W | W | | | |
| Doctors | W | | W | | | |
| Appointments | W | W | W | | | |
| Medical records | W | W | | | | |
| Laboratory | W | W | | W | | |
| Pharmacy | W | | | | W | |
| Billing | W | | W | | | W |
| Staff | W | | | | | |
| Dashboard report | R | R | | | | R |

`GET /users` and `PATCH /users/:id/status` are Admin-only for both read and write (unlike the modules
above), and `POST /users/invitations` too - covered separately in `RBAC - user management is Admin-only`
and `tests/users/user-management.spec.ts`.

## Known limitations

No test is skipped. These behaviours are asserted as they are today, not as bugs: validation failures such as a
duplicate MRN or an invalid enum return a generic `500`, so those tests assert "status >= 400 and an error is shown"; invoice
`total` is client-supplied and not validated against `items`; read access to the CRUD modules (patients, doctors,
...) is open to any authenticated role, unlike `/users` which is Admin-only for both reads and writes; PATCH
echoes the input while GET returns database-normalised values (`"900"` vs `"900.00"`); the public `/register`
page can never succeed (backend README: "anonymous registration is intentionally disabled") -
`tests/auth/registration.spec.ts` documents this rather than treating it as a bug.

## Changes made to the application for testability

- `data-testid` attributes on login, layout, dashboard cards, the shared module page, and the password fields
  and submit buttons on the activate-account and invite-staff forms.
- Module forms now show the API error message and a success notice (previously a failed save was silent).
- Patient form was missing the required `medicalRecordNumber` field (the API rejected every UI-created patient).
- Each module route now has a `key`, fixing stale data when switching modules from the sidebar (found by the
  RBAC navigation test): the previous module's rows stayed on screen and no request was made.
- `RATE_LIMIT_MAX` env var for the API rate limiter; default is 300 in production and effectively unlimited otherwise
  (a 300-request limit locks a full run out after ~100 tests with `429`).
- `GET /health` reports `databaseHost` outside production, so `global-setup` can refuse a remote database.
- New **Medical records** screen (`/medical-records`, sidebar entry) - previously the route fell back to the dashboard.
- **Search** is now case-insensitive substring matching (`ILIKE`, wildcards escaped) across the searchable columns:
  patients (MRN), doctors (department) and, new, medicines (name, SKU). It used to be an exact match on the
  lowercased term and was ignored for medicines.
- **Session expiry**: a 401 from the API (other than a failed login) clears the stored session and sends the SPA to `/login`.

The invitation-based staff onboarding, the admin-only lockdown of `/auth/register`, and the `/users` screen are
existing application features, not something this suite added - see `backend/README.md`.

## Safety (read this first)

The suite **creates users (including an Admin with a known password) and inserts data** into whatever database
the backend points at. Use a dedicated test database - a throwaway local Postgres, a dedicated Neon branch, or the
CI service container - **never production or a shared dev database**.

`global-setup` enforces this: it reads `databaseHost` from `/health` and **stops with an error if the backend is
connected to a non-local database**, unless you set `E2E_ALLOW_REMOTE_DB=true`. Cleanup applies the same rule.
When Playwright starts the backend itself (`E2E_START_SERVERS=true`) the backend still reads `backend/.env`, so
export `DATABASE_URL` (and the other backend variables) to override it.

If a run already went to a shared database, remove the leftovers (users and invitations `*@hms-e2e.test`, and
rows prefixed `e2e-`) with: `E2E_DATABASE_URL=<that database> E2E_DATABASE_SSL=true E2E_ALLOW_REMOTE_DB=true npm run cleanup`.

**`e2e/.env` must never point at a real database.** `E2E_DATABASE_URL`/`E2E_ALLOW_REMOTE_DB` here are for
*this suite's own* bootstrap and cleanup, which is a different thing from `backend/.env`'s `DATABASE_URL` (the
app's real database). Copy `backend/.env`'s value into `e2e/.env` only if it already points at a disposable
database (a local Postgres, or a Neon branch made specifically for tests) - never the same database a real
deployment or your own development session uses. A safe local default is simply:
```
E2E_DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<disposable_db>
E2E_DATABASE_SSL=false
E2E_ALLOW_REMOTE_DB=false
```

**`backend/.env`'s SMTP credentials are live and will be used by any backend process that loads that file,
E2E included.** `POST /users/invitations` really calls `nodemailer.sendMail` whenever `SMTP_HOST` and
`EMAIL_FROM` are set - there is no test/dry-run mode. Running this suite's invitation tests (`tests/users/user-management.spec.ts`,
`data.invitation()`) against a backend that has real SMTP configured will send real emails to fabricated
`@hms-e2e.test` addresses, which typically bounce back into the sending inbox. Before running the suite locally
against your own `backend/.env`, blank the SMTP variables for that process so `isEmailConfigured()` is false and
`emailSent` is deterministically `false` (which is what the tests assert):
```bash
# PowerShell, one-off for a manual backend run:
$env:SMTP_HOST = ""; npm run dev --workspace backend
```
The GitHub Actions workflow is already safe: it defines the backend's environment entirely in `e2e.yml` and
never loads `backend/.env`, so `SMTP_HOST` is simply unset in CI.

### Using a Neon branch as the disposable database

A Neon branch works well here: real Postgres, cheap to create, and you can throw it away or reset it any time.
Keep it completely separate from `backend/.env`'s branch.

1. **Create a branch dedicated to this** - Neon console: your project → Branches → New branch (branch from
   `main`), or `neonctl branches create --name e2e-tests`. Never reuse a branch a real deployment or your own
   dev session also writes to.
2. **Get its pooled connection string** - console: select that branch → Connect → Node.js.
3. **Run the backend against it with a separate env file**, so `backend/.env` (and its real database and SMTP
   credentials) is never touched:
   ```bash
   cp backend/.env.e2e.example backend/.env.e2e   # fill in the branch's connection string
   # then, from backend/:
   DOTENV_CONFIG_PATH=.env.e2e npx tsx src/server.ts   # bash
   ```
   ```powershell
   # PowerShell, from backend/:
   $env:DOTENV_CONFIG_PATH = ".env.e2e"; npx tsx src/server.ts
   ```
   (`config/env.ts` already does `import 'dotenv/config'`, which reads `DOTENV_CONFIG_PATH` from the
   environment on its own - no code change or extra flag needed. Verified against a local Postgres before
   writing this down. `backend/.env.e2e.example` leaves `SMTP_HOST` blank for the reason above.)
4. **Point `e2e/.env` at the same branch**, and allow the remote host since a Neon branch is not `localhost`:
   ```
   E2E_DATABASE_URL=<the same pooled connection string>
   E2E_DATABASE_SSL=true
   E2E_ALLOW_REMOTE_DB=true
   ```
5. Start the frontend normally (`npm run dev --workspace frontend`) and run `npm run test` from `e2e/` as usual.

Optional: instead of (or in addition to) the app-level cleanup (`E2E_CLEANUP=end`), Neon can reset the whole
branch back to its parent's state in one call - useful for a fully clean slate between runs:
`neonctl branches reset e2e-tests --parent`.

## CI

`.github/workflows/e2e.yml` starts a PostgreSQL 16 service, installs dependencies and Chromium, lets Playwright
start backend + frontend (`E2E_START_SERVERS=true`), runs the suite with 2 retries and uploads the HTML report,
JUnit XML and (on failure) traces, screenshots and videos as artifacts.

## Troubleshooting

- **`API is not reachable`** - start the backend, or set `E2E_START_SERVERS=true`.
- **`429 Too Many Requests` / most tests fail after ~100** - the API limiter (300 / 15 min in production mode) was
  exhausted. Restart the backend (the counter is in memory) and run with `NODE_ENV=development`.
- **Login timeouts under many workers** - the API hashes with pure-JS bcrypt (cost 12), which blocks its event loop;
  `LoginPage.login` already allows 30 s. Fewer workers (`--workers=2`) also helps.
- **"No admin account exists yet, and POST /auth/register is admin-only..."** - set `E2E_DATABASE_URL` so
  `global-setup` can seed the first Admin directly in the database (see [Prerequisites](#prerequisites)).
- **`relation "users" does not exist`** (or any other table) - `E2E_DATABASE_URL` and the running backend's own
  `DATABASE_URL` point at two different databases. Tables only get created when the backend itself starts up
  successfully against a database (`sequelize.sync()`), so global-setup's direct connection finds an empty schema
  on whichever one it's pointed at instead. `global-setup` now catches this specific case with a clear error
  naming both hosts, comparing the backend's own `/health` report against `E2E_DATABASE_URL` - make sure they
  match exactly (see "Using a Neon branch" above for the usual cause: forgetting `DOTENV_CONFIG_PATH=.env.e2e`
  when starting the backend).
- **"E2E_DATABASE_URL points at ... but the running backend is connected to ..."** - the check above. Restart the
  backend with a `DATABASE_URL` matching `E2E_DATABASE_URL` exactly, and let it finish starting up once (that's
  when Sequelize creates the schema) before running the suite again.
- **Open a trace:** `npx playwright show-trace test-results/<test>/trace.zip`.
