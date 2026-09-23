const DAY_MS = 24 * 60 * 60 * 1000;

export const isoDate = (date: Date): string => date.toISOString().slice(0, 10);
export const daysFromNow = (days: number): Date => new Date(Date.now() + days * DAY_MS);
export const dateOnly = (days: number): string => isoDate(daysFromNow(days));
/** Future appointment slot, always at a whole hour in UTC, as the UI/API expect ISO strings. */
export const futureSlot = (days = 7, hourUtc = 10): string => {
  const d = daysFromNow(days);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
};
