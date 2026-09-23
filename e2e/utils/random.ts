/** Short lowercase alphanumeric id. Lowercase matters: the API lowercases search terms. */
export const uid = (length = 8): string =>
  Math.random().toString(36).slice(2, 2 + length).padEnd(length, '0');

/** Every record created by the suite carries this prefix so it can be swept from the DB. */
export const MARKER = 'e2e';
