import { uid } from '../utils/random';
import { calcInvoiceTotal, InvoiceLine } from '../utils/money';

export const DEFAULT_LINES: InvoiceLine[] = [
  { description: 'Consultation', quantity: 1, unitPrice: 500 },
  { description: 'Blood test', quantity: 2, unitPrice: 150.25 },
  { description: 'X-ray', quantity: 1, unitPrice: 799.99 }
];

export interface InvoiceInput { patientId: number; invoiceNumber: string; items: InvoiceLine[]; total: number }

/** `total` is derived from `items` because the API stores whatever total the client sends. */
export const buildInvoice = (patientId: number, items: InvoiceLine[] = DEFAULT_LINES, overrides: Partial<InvoiceInput> = {}): InvoiceInput => ({
  patientId,
  invoiceNumber: `e2e-inv-${uid()}`,
  items,
  total: calcInvoiceTotal(items),
  ...overrides
});
