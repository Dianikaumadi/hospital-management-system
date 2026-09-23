import { env } from './config/env';
import { cleanupConfigured, closePool, sweepMarkedData } from './utils/db';

/** Removes every e2e-* record after the run (needs E2E_DATABASE_URL, see README). */
export default async function globalTeardown(): Promise<void> {
  if (!cleanupConfigured()) {
    if (env.cleanup !== 'off') {
      console.log('[e2e] Test data cleanup skipped (E2E_DATABASE_URL not set). Records prefixed "e2e-" remain in the database.');
    }
    return;
  }
  try {
    const deleted = await sweepMarkedData();
    console.log('[e2e] Cleanup complete:', JSON.stringify(deleted));
  } catch (error) {
    // Never fail a test run because cleanup failed.
    console.warn('[e2e] Cleanup failed:', (error as Error).message);
  } finally {
    await closePool();
  }
}
