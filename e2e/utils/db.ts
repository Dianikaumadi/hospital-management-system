import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { env } from '../config/env';

/**
 * Test data cleanup.
 *
 * The backend exposes no DELETE endpoints, so cleanup goes straight to PostgreSQL. It is opt-in
 * (needs E2E_DATABASE_URL) and only ever removes rows the suite created:
 *   - explicit ids tracked during a test, and
 *   - rows carrying the `e2e-` / `@hms-e2e.test` markers (sweep at the end of a run).
 */

export type TrackedTable =
  | 'appointments' | 'medical_records' | 'lab_tests' | 'invoices' | 'staff' | 'doctors' | 'medicines' | 'patients'
  | 'invitations' | 'users';

export interface Tracked { table: TrackedTable; id: number }

/** Children first so foreign keys never block a delete. */
const DELETE_ORDER: TrackedTable[] = [
  'appointments', 'medical_records', 'lab_tests', 'invoices', 'staff', 'doctors', 'medicines', 'patients',
  'invitations', 'users'
];

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', 'postgres'];

export const cleanupConfigured = (): boolean => env.databaseUrl !== '' && env.cleanup !== 'off';

const assertSafeTarget = (): void => {
  const host = new URL(env.databaseUrl).hostname;
  if (!LOCAL_HOSTS.includes(host) && !env.allowRemoteDb) {
    throw new Error(
      `Refusing to run cleanup against non-local database host "${host}". ` +
      'Set E2E_ALLOW_REMOTE_DB=true if you really want this.'
    );
  }
};

let pool: Pool | undefined;
const getPool = (): Pool => {
  assertSafeTarget();
  pool ??= new Pool({
    connectionString: env.databaseUrl,
    ssl: env.databaseSsl ? { rejectUnauthorized: true } : undefined,
    max: 2
  });
  return pool;
};

export const closePool = async (): Promise<void> => {
  await pool?.end();
  pool = undefined;
};

/**
 * Turns Postgres' "relation ... does not exist" (42P01) into an actionable message: it almost always
 * means this connection points at a database the backend has never successfully started against (so
 * Sequelize never created the schema), typically because E2E_DATABASE_URL and the backend's own
 * DATABASE_URL have drifted apart - see e2e/README.md "Using a Neon branch". Everything else passes through.
 */
const explainPgError = (error: unknown): Error => {
  if ((error as { code?: string })?.code === '42P01') {
    return new Error(
      `${(error as Error).message} - this database has no schema yet. Sequelize only creates tables when the ` +
      'backend itself starts up successfully against this SAME database, so either it has never done that here, ' +
      'or it is currently connected elsewhere. Make sure the backend\'s DATABASE_URL matches E2E_DATABASE_URL exactly.'
    );
  }
  return error as Error;
};

/**
 * Fast-forwards a pending invitation past its expiry, so a real "expired invitation" can be tested
 * without waiting INVITATION_EXPIRES_HOURS. Matches by email (the caller only has the raw token,
 * never the stored hash) and only touches invitations that have not been used yet.
 */
export async function expireInvitation(email: string): Promise<void> {
  const db = getPool();
  try {
    await db.query(
      `UPDATE invitations SET expires_at = now() - interval '1 hour' WHERE email = $1 AND used_at IS NULL`,
      [email.toLowerCase()]
    );
  } catch (error) {
    throw explainPgError(error);
  }
}

export interface SeedAdmin { firstName: string; lastName: string; email: string; password: string }

/**
 * Directly inserts the initial Admin user, bcrypt-hashing the password the same way the backend
 * does (cost 12) so the normal login endpoint accepts it afterwards.
 *
 * The API's POST /auth/register is admin-only by design (see backend README: "A deployment must
 * seed its first administrator directly in the database or through a one-time controlled bootstrap
 * process; anonymous registration is intentionally disabled"), so there is no API path to create the
 * very first account - this is that one-time bootstrap. `assertSafeTarget` (via getPool) still
 * refuses to do this against a non-local database unless E2E_ALLOW_REMOTE_DB=true.
 * Safe to call repeatedly: ON CONFLICT (email) does nothing if the account already exists.
 */
export async function seedAdminUser(admin: SeedAdmin): Promise<void> {
  const db = getPool();
  const passwordHash = await bcrypt.hash(admin.password, 12);
  try {
    await db.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Admin', true, now(), now())
       ON CONFLICT (email) DO NOTHING`,
      [admin.firstName, admin.lastName, admin.email.toLowerCase(), passwordHash]
    );
  } catch (error) {
    throw explainPgError(error);
  }
}

/** Deletes specific rows tracked by a single test. Failures are reported, never thrown. */
export async function deleteTracked(tracked: Tracked[]): Promise<string[]> {
  const problems: string[] = [];
  if (!cleanupConfigured() || tracked.length === 0) return problems;
  const db = getPool();
  for (const table of DELETE_ORDER) {
    const ids = [...new Set(tracked.filter((t) => t.table === table).map((t) => t.id))];
    if (ids.length === 0) continue;
    try {
      await db.query(`DELETE FROM ${table} WHERE id = ANY($1::int[])`, [ids]);
    } catch (error) {
      problems.push(`${table} ${ids.join(',')}: ${explainPgError(error).message}`);
    }
  }
  return problems;
}

/** Removes every row created by the suite, identified by the e2e markers. */
export async function sweepMarkedData(): Promise<Record<string, number>> {
  const db = getPool();
  const deleted: Record<string, number> = {};
  const run = async (label: string, sql: string): Promise<void> => {
    try {
      const result = await db.query(sql);
      deleted[label] = result.rowCount ?? 0;
    } catch (error) {
      throw explainPgError(error);
    }
  };

  const patients = `(SELECT id FROM patients WHERE medical_record_number LIKE 'e2e-%')`;
  const doctors = `(SELECT id FROM doctors WHERE license_number LIKE 'e2e-lic-%' OR user_id IN (SELECT id FROM users WHERE email LIKE '%@${env.emailDomain}'))`;

  await run('appointments', `DELETE FROM appointments WHERE patient_id IN ${patients} OR doctor_id IN ${doctors}`);
  await run('medical_records', `DELETE FROM medical_records WHERE patient_id IN ${patients}`);
  await run('lab_tests', `DELETE FROM lab_tests WHERE patient_id IN ${patients} OR test_name LIKE 'E2E %'`);
  await run('invoices', `DELETE FROM invoices WHERE patient_id IN ${patients} OR invoice_number LIKE 'e2e-inv-%'`);
  await run('staff', `DELETE FROM staff WHERE employee_number LIKE 'e2e-emp-%' OR user_id IN (SELECT id FROM users WHERE email LIKE '%@${env.emailDomain}')`);
  await run('doctors', `DELETE FROM doctors WHERE id IN ${doctors}`);
  await run('medicines', `DELETE FROM medicines WHERE sku LIKE 'e2e-sku-%'`);
  await run('patients', `DELETE FROM patients WHERE medical_record_number LIKE 'e2e-%'`);
  await run('invitations', `DELETE FROM invitations WHERE email LIKE '%@${env.emailDomain}'`);
  await run('users', `DELETE FROM users WHERE email LIKE '%@${env.emailDomain}'`);
  return deleted;
}
