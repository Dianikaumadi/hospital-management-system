import { ModuleListPage } from './ModuleListPage';

export interface InvoiceForm { patientId: number | string; invoiceNumber: string; total: number | string }

export class BillingPage extends ModuleListPage<InvoiceForm> {
  readonly path = '/billing';
  readonly apiPath = '/api/billing/invoices';
  readonly title = 'Invoices';
  readonly navItem = 'billing' as const;
}
