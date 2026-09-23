import { FullConfig, expect, request } from '@playwright/test';
import fs from 'fs';
import { ApiClient } from './api/ApiClient';
import { endpoints } from './api/endpoints';
import type { AuthUser, Doctor, Envelope } from './api/types';
import { env } from './config/env';
import { AUTH_DIR, SESSION_FILE } from './config/paths';
import { ROLE_KEYS, RoleKey, storageStatePath, TestUser, users } from './fixtures/users';
import { buildDoctor } from './fixtures/doctors';
import { seedAdminUser } from './utils/db';
import type { Session } from './utils/session';

/**
 * Runs once before the suite:
 *  1. verifies the frontend and API are reachable,
 *  2. logs in (seeding the very first Admin directly in the database if needed) then registers the
 *     other five role accounts through the API using the admin's token,
 *  3. makes sure the E2E doctor account has a doctor profile,
 *  4. writes tokens + a browser storageState per role so UI tests skip the login screen.
 */
const MIN_RATE_LIMIT = 2_000;
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', 'postgres'];

/**
 * POST /auth/register is admin-only (no anonymous bootstrap - see the backend README), so the very
 * first account cannot be created through the API at all. If login fails, seed it directly in the
 * database instead - the same one-time bootstrap a real deployment would need - then log in normally
 * so the token comes from the real login endpoint.
 */
async function ensureAdmin(): Promise<{ token: string; user: AuthUser }> {
  const login = await ApiClient.login(users.admin.email, users.admin.password);
  if (login.result) return login.result;
  if (login.status !== 401) throw new Error(`Login for ${users.admin.email} failed with ${login.status}: ${login.body}`);

  if (!env.databaseUrl) {
    throw new Error(
      `No admin account ("${users.admin.email}") exists yet, and POST /auth/register is admin-only, so there is no ` +
      'API path to create the first one. Set E2E_DATABASE_URL so global-setup can seed it directly in the database ' +
      '(this is also how a real deployment bootstraps its first administrator - see backend/README.md).'
    );
  }
  await seedAdminUser(users.admin);
  const retry = await ApiClient.login(users.admin.email, users.admin.password);
  if (!retry.result) throw new Error(`Seeded the admin user directly in the database, but login still failed: ${retry.status} ${retry.body}`);
  return retry.result;
}

/** Every other role: log in, or register with the admin's token if the account does not exist yet. */
async function ensureAccount(user: TestUser, adminToken: string): Promise<{ token: string; user: AuthUser }> {
  const login = await ApiClient.login(user.email, user.password);
  if (login.result) return login.result;
  if (login.status !== 401) throw new Error(`Login for ${user.email} failed with ${login.status}: ${login.body}`);

  const api = await ApiClient.create(adminToken);
  try {
    const response = await api.post(endpoints.register, {
      firstName: user.firstName, lastName: user.lastName, email: user.email, password: user.password, role: user.role
    });
    expect(response.status(), `register ${user.email}: ${await response.text()}`).toBe(201);
    return ((await response.json()) as Envelope<{ token: string; user: AuthUser }>).data;
  } finally {
    await api.dispose();
  }
}

async function ensureDoctorProfile(adminApi: ApiClient, doctorUser: AuthUser): Promise<number> {
  const existing = (await adminApi.list<Doctor>(endpoints.doctors)).find((d) => d.userId === doctorUser.id);
  if (existing) return existing.id;
  const created = await adminApi.postData<Doctor>(endpoints.doctors, {
    ...buildDoctor(doctorUser.id, { specialization: 'General Medicine', department: 'e2e-general' }),
    licenseNumber: `e2e-lic-seed-${doctorUser.id}`
  });
  return created.id;
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  // 1. Reachability
  const probe = await request.newContext();
  try {
    const health = await probe.get(`${env.apiUrl}/health`).catch(() => undefined);
    if (health?.status() === 429) {
      const resetsAt = new Date(Number(health.headers()['x-ratelimit-reset']) * 1000).toLocaleTimeString();
      throw new Error(
        `The API is rate limiting this machine (429 Too Many Requests, resets ~${resetsAt}). ` +
        'Restart the backend to clear the counter; it now defaults to no practical limit outside NODE_ENV=production.'
      );
    }
    if (!health?.ok()) {
      throw new Error(`API is not reachable at ${env.apiUrl}/health. Start the backend (npm run dev) or set E2E_START_SERVERS=true.`);
    }

    // A full run makes ~800 API calls (two back-to-back runs must fit in one 15 min window); a low limit (default in production: 300) would fail most tests with 429.
    const limit = Number(health.headers()['x-ratelimit-limit']);
    if (limit && limit < MIN_RATE_LIMIT) {
      throw new Error(
        `API rate limit is ${limit} requests / 15 min - too low for this suite (needs >= ${MIN_RATE_LIMIT}). ` +
        'Start the backend with NODE_ENV=development or RATE_LIMIT_MAX=100000.'
      );
    }

    // This suite creates users (including an Admin) and data. Refuse to do that to a remote database by accident.
    const databaseHost = ((await health.json().catch(() => ({}))) as { databaseHost?: string }).databaseHost;
    if (databaseHost && !LOCAL_HOSTS.includes(databaseHost) && !env.allowRemoteDb) {
      throw new Error(
        `The backend is connected to a remote database (${databaseHost}). The E2E suite would create test users - including an ` +
        'Admin with a known password - and data there. Point the backend at a disposable local/CI database, or set ' +
        'E2E_ALLOW_REMOTE_DB=true if this database is meant for testing (e.g. a dedicated Neon branch).'
      );
    }

    // global-setup also connects to E2E_DATABASE_URL directly (to seed the admin and, later, clean up) -
    // a completely separate connection from whatever the running backend uses. If they are not the same
    // database, that direct connection hits an empty schema (Sequelize only creates tables on the backend's
    // own startup) and fails with a confusing "relation ... does not exist" instead of this clear message.
    if (databaseHost && env.databaseUrl) {
      const e2eHost = new URL(env.databaseUrl).hostname.toLowerCase();
      if (e2eHost !== databaseHost.toLowerCase()) {
        throw new Error(
          `E2E_DATABASE_URL points at "${e2eHost}", but the running backend is connected to "${databaseHost}". ` +
          'They must be the exact same database - global-setup reads and writes it directly alongside the backend. ' +
          'Make sure the backend was started with a DATABASE_URL matching E2E_DATABASE_URL (e.g. with ' +
          'DOTENV_CONFIG_PATH=.env.e2e when testing against a Neon branch - see e2e/README.md "Using a Neon branch"), ' +
          'and that it started up successfully at least once so Sequelize could create the schema there.'
        );
      }
    }
    const web = await probe.get(env.baseUrl).catch(() => undefined);
    if (!web?.ok()) throw new Error(`Frontend is not reachable at ${env.baseUrl}. Start it (npm run dev) or set E2E_START_SERVERS=true.`);
  } finally {
    await probe.dispose();
  }

  // 2. Accounts - admin first, so it can register the rest (registration is admin-only).
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const tokens = {} as Record<RoleKey, string>;
  const apiUsers = {} as Record<RoleKey, AuthUser>;
  const admin = await ensureAdmin();
  tokens.admin = admin.token;
  apiUsers.admin = admin.user;
  for (const key of ROLE_KEYS.filter((k) => k !== 'admin')) {
    const account = await ensureAccount(users[key], admin.token);
    tokens[key] = account.token;
    apiUsers[key] = account.user;
  }

  // 3. Shared doctor profile
  const adminApi = await ApiClient.create(tokens.admin);
  let doctorId: number;
  try {
    doctorId = await ensureDoctorProfile(adminApi, apiUsers.doctor);
  } finally {
    await adminApi.dispose();
  }

  // 4. Persist session + per-role storage state (what the React app keeps in localStorage)
  const session: Session = { tokens, users: apiUsers, doctorId };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  for (const key of ROLE_KEYS) {
    const state = {
      cookies: [],
      origins: [{
        origin: env.baseUrl,
        localStorage: [
          { name: 'hms_token', value: tokens[key] },
          { name: 'hms_user', value: JSON.stringify(apiUsers[key]) }
        ]
      }]
    };
    fs.writeFileSync(storageStatePath(key), JSON.stringify(state, null, 2));
  }
  console.log(`[e2e] Ready: ${ROLE_KEYS.length} role accounts, doctor profile #${doctorId}`);
}
