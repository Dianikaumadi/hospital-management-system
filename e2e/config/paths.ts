import path from 'path';

export const ROOT_DIR = path.resolve(__dirname, '..');
export const AUTH_DIR = path.join(ROOT_DIR, '.auth');
/** Written by global-setup: tokens, user records and the shared doctor profile. */
export const SESSION_FILE = path.join(AUTH_DIR, 'session.json');
export const FIXTURE_FILES_DIR = path.join(ROOT_DIR, 'fixtures', 'files');
