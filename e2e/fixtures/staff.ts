import { uid } from '../utils/random';
import { dateOnly } from '../utils/dates';

export interface StaffInput { userId: number; employeeNumber: string; department: string; hireDate: string }

export const buildStaff = (userId: number, overrides: Partial<StaffInput> = {}): StaffInput => ({
  userId,
  employeeNumber: `e2e-emp-${uid()}`,
  department: 'Administration',
  hireDate: dateOnly(-400),
  ...overrides
});
