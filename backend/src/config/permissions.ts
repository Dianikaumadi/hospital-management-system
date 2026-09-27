import { Role } from '../types/auth';

export interface ModuleAccess {
  /** Roles allowed to list and view records (GET). */
  read: Role[];
  /** Roles allowed to create and update records (POST/PATCH). */
  write: Role[];
}

// Least-privilege access per module: a role only reads what its job needs. Write lists are unchanged;
// read lists add view-only access where a role needs to look records up (e.g. Lab Staff -> patients).
// Keep in sync with frontend/src/utils/permissions.ts, which hides menu items and buttons accordingly.
export const MODULE_ACCESS = {
  patients: {
    read: ['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Laboratory Staff', 'Accountant'],
    write: ['Admin', 'Doctor', 'Nurse', 'Receptionist']
  },
  doctors: { read: ['Admin', 'Doctor', 'Nurse', 'Receptionist'], write: ['Admin', 'Receptionist'] },
  appointments: { read: ['Admin', 'Doctor', 'Nurse', 'Receptionist'], write: ['Admin', 'Doctor', 'Nurse', 'Receptionist'] },
  medicalRecords: { read: ['Admin', 'Doctor', 'Nurse'], write: ['Admin', 'Doctor', 'Nurse'] },
  laboratory: { read: ['Admin', 'Doctor', 'Nurse', 'Laboratory Staff'], write: ['Admin', 'Doctor', 'Nurse', 'Laboratory Staff'] },
  pharmacy: { read: ['Admin', 'Pharmacist'], write: ['Admin', 'Pharmacist'] },
  billing: { read: ['Admin', 'Accountant', 'Receptionist'], write: ['Admin', 'Accountant', 'Receptionist'] },
  staff: { read: ['Admin'], write: ['Admin'] }
} satisfies Record<string, ModuleAccess>;
