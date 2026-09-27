/** The system bills in Sri Lankan Rupees; every monetary value is stored and displayed in LKR. */
export const CURRENCY = 'LKR';

/** Columns/fields that hold money amounts. */
export const MONEY_FIELDS = new Set(['total', 'consultationFee', 'unitPrice']);

/** 1234.5 or "1234.50" -> "LKR 1,234.50" */
export const formatLKR = (value: number | string): string =>
  `${CURRENCY} ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
