import fs from 'fs';
import { SESSION_FILE } from '../config/paths';
import type { AuthUser } from '../api/types';
import type { RoleKey } from '../fixtures/users';

/** Everything global-setup learned about the environment; read by workers. */
export interface Session {
  tokens: Record<RoleKey, string>;
  users: Record<RoleKey, AuthUser>;
  /** Shared doctor profile (row in `doctors`) that belongs to the E2E doctor account. */
  doctorId: number;
}

let cached: Session | undefined;

export const loadSession = (): Session => {
  if (cached) return cached;
  if (!fs.existsSync(SESSION_FILE)) {
    throw new Error(`Session file missing (${SESSION_FILE}). global-setup did not run - run tests via "npm test".`);
  }
  cached = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) as Session;
  return cached;
};
