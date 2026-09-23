import { FullConfig, expect, request } from '@playwright/test';
import fs from 'fs';
import { ApiClient } from './api/ApiClient';
import { endpoints } from './api/endpoints';
import type { AuthUser, Doctor, Envelope } from './api/types';
import { env } from './config/env';
import { AUTH_DIR, SESSION_FILE } from './config/paths';
import { ROLE_KEYS, RoleKey, storageStatePath, TestUser, users } from './fixtures/users';
import { buildDoctor } from './fixtures/doctors';
import type { Session } from './utils/session';

/**
 * Runs once before the suite:
 *  1. verifies the frontend and API are reachable,
 *  2. logs in (or registers) one account per role through the API,
 *  3. makes sure the E2E doctor account has a doctor profile,
 *  4. writes tokens + a browser storageState per role so UI tests skip the login screen.
 */
const MIN_RATE_LIMIT = 2_000;
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', 'postgres'];

async function ensureAccount(user: TestUser, adminToken?: string): Promise<{ token: string; user: AuthUser }> {
  const login = await ApiClient.login(user.email, user.password);
  if (login.result) return login.result;

  if (login.status !== 401) {
    throw new Error(`Login for ${user.email} failed with ${login.status}: ${login.body}`);
  }

  // Account does not exist yet - register it. The Authorization header is only required when the
  // backend runs with REQUIRE_ADMIN_REGISTRATION=true.
  const api = await ApiClient.create(adminToken);
  try {
    const response = await api.post(endpoints.register, {
      firstName: user.firstName, lastName: user.lastName, email: user.email, password: user.password, role: user.role
    });
    if (response.status() === 403) {
      throw new Error(
        `Cannot register ${user.email}: registration is admin-only and no admin exists yet. ` +
        `Create the account manually or start the backend with REQUIRE_ADMIN_REGISTRATION=false for the first run.`
      );
    }
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
    const web = await probe.get(env.baseUrl).catch(() => undefined);
    if (!web?.ok()) throw new Error(`Frontend is not reachable at ${env.baseUrl}. Start it (npm run dev) or set E2E_START_SERVERS=true.`);
  } finally {
    await probe.dispose();
  }

  // 2. Accounts - admin first, so it can authorise the rest if registration is restricted.
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const tokens = {} as Record<RoleKey, string>;
  const apiUsers = {} as Record<RoleKey, AuthUser>;
  const admin = await ensureAccount(users.admin);
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
