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
  | 'appointments' | 'medical_records' | 'lab_tests' | 'invoices' | 'staff' | 'doctors' | 'medicines' | 'patients' | 'users';

export interface Tracked { table: TrackedTable; id: number }

/** Children first so foreign keys never block a delete. */
const DELETE_ORDER: TrackedTable[] = [
  'appointments', 'medical_records', 'lab_tests', 'invoices', 'staff', 'doctors', 'medicines', 'patients', 'users'
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
      problems.push(`${table} ${ids.join(',')}: ${(error as Error).message}`);
    }
  }
  return problems;
}

/** Removes every row created by the suite, identified by the e2e markers. */
export async function sweepMarkedData(): Promise<Record<string, number>> {
  const db = getPool();
  const deleted: Record<string, number> = {};
  const run = async (label: string, sql: string): Promise<void> => {
    const result = await db.query(sql);
    deleted[label] = result.rowCount ?? 0;
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
  await run('users', `DELETE FROM users WHERE email LIKE '%@${env.emailDomain}'`);
  return deleted;
}
