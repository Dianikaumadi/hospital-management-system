import { Role } from '../types';

export type ModuleKey = 'patients' | 'doctors' | 'appointments' | 'medicalRecords' | 'laboratory' | 'pharmacy' | 'billing';

// Mirrors backend/src/config/permissions.ts. The API enforces these rules; the UI uses them to show each
// role only the menu items, screens and "Add new" buttons it can actually use.
const ACCESS: Record<ModuleKey, { read: Role[]; write: Role[] }> = {
  patients: {
    read: ['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Laboratory Staff', 'Accountant'],
    write: ['Admin', 'Doctor', 'Nurse', 'Receptionist']
  },
  doctors: { read: ['Admin', 'Doctor', 'Nurse', 'Receptionist'], write: ['Admin', 'Receptionist'] },
  appointments: { read: ['Admin', 'Doctor', 'Nurse', 'Receptionist'], write: ['Admin', 'Doctor', 'Nurse', 'Receptionist'] },
  medicalRecords: { read: ['Admin', 'Doctor', 'Nurse'], write: ['Admin', 'Doctor', 'Nurse'] },
  laboratory: { read: ['Admin', 'Doctor', 'Nurse', 'Laboratory Staff'], write: ['Admin', 'Doctor', 'Nurse', 'Laboratory Staff'] },
  pharmacy: { read: ['Admin', 'Pharmacist'], write: ['Admin', 'Pharmacist'] },
  billing: { read: ['Admin', 'Accountant', 'Receptionist'], write: ['Admin', 'Accountant', 'Receptionist'] }
};

export const canRead = (role: Role | undefined, module: ModuleKey): boolean => !!role && ACCESS[module].read.includes(role);
export const canWrite = (role: Role | undefined, module: ModuleKey): boolean => !!role && ACCESS[module].write.includes(role);
