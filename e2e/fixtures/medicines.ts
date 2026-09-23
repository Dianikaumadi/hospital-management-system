import { uid } from '../utils/random';
import { dateOnly } from '../utils/dates';

export interface MedicineInput {
  name: string;
  sku: string;
  quantity: number;
  reorderLevel?: number;
  unitPrice: string;
  expiryDate?: string;
}

export const buildMedicine = (overrides: Partial<MedicineInput> = {}): MedicineInput => {
  const id = uid();
  return {
    name: `E2E Medicine ${id}`,
    sku: `e2e-sku-${id}`,
    quantity: 120,
    reorderLevel: 20,
    unitPrice: '12.50',
    expiryDate: dateOnly(365),
    ...overrides
  };
};
