import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const read = (name: string, fallback: string): string => process.env[name] || fallback;
const flag = (name: string, fallback: boolean): boolean => {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : ['1', 'true', 'yes'].includes(value.toLowerCase());
};

const isCI = flag('CI', false);
const apiUrl = read('E2E_API_URL', 'http://localhost:4000').replace(/\/$/, '');

export type CleanupMode = 'end' | 'test' | 'off';

export const env = {
  isCI,
  baseUrl: read('E2E_BASE_URL', 'http://localhost:5173').replace(/\/$/, ''),
  apiUrl,
  /** All REST endpoints live under /api. */
  apiBase: `${apiUrl}/api`,
  userPassword: read('E2E_USER_PASSWORD', 'E2eTest#2026'),
  emailDomain: read('E2E_EMAIL_DOMAIN', 'hms-e2e.test'),
  startServers: flag('E2E_START_SERVERS', isCI),
  databaseUrl: process.env.E2E_DATABASE_URL || '',
  databaseSsl: flag('E2E_DATABASE_SSL', false),
  allowRemoteDb: flag('E2E_ALLOW_REMOTE_DB', false),
  cleanup: read('E2E_CLEANUP', 'end') as CleanupMode
};
