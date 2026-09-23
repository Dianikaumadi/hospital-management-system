import { ModuleListPage } from './ModuleListPage';

export interface MedicineForm { name: string; sku: string; quantity: number | string; unitPrice: number | string }

export class PharmacyPage extends ModuleListPage<MedicineForm> {
  readonly path = '/pharmacy';
  readonly apiPath = '/api/pharmacy/medicines';
  readonly title = 'Medicines';
  readonly navItem = 'pharmacy' as const;
}
