import { env } from '../config/env';
import { closePool, sweepMarkedData } from '../utils/db';

/** Manual sweep: npm run cleanup */
(async () => {
  if (!env.databaseUrl) {
    console.error('E2E_DATABASE_URL is not set - nothing to clean.');
    process.exit(1);
  }
  try {
    console.log('Deleted rows:', await sweepMarkedData());
  } finally {
    await closePool();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
