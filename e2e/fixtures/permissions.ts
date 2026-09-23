import { endpoints } from '../api/endpoints';
import type { NavItem } from '../pages/components/AppShell';
import type { RoleKey } from './users';

export type ModuleKey =
  | 'patients' | 'doctors' | 'appointments' | 'medicalRecords' | 'laboratory' | 'pharmacy' | 'billing' | 'staff';

export interface ModuleDefinition {
  label: string;
  /** REST path relative to /api/. */
  endpoint: string;
  /** Sidebar entry, when the SPA has a screen for this module. */
  nav?: NavItem;
  /** Heading rendered by the screen. */
  title?: string;
}

export const MODULES: Record<ModuleKey, ModuleDefinition> = {
  patients: { label: 'Patients', endpoint: endpoints.patients, nav: 'patients', title: 'Patients' },
  doctors: { label: 'Doctors', endpoint: endpoints.doctors, nav: 'doctors', title: 'Doctors' },
  appointments: { label: 'Appointments', endpoint: endpoints.appointments, nav: 'appointments', title: 'Appointments' },
  medicalRecords: { label: 'Medical records', endpoint: endpoints.medicalRecords, nav: 'medical-records', title: 'Medical records' },
  laboratory: { label: 'Laboratory', endpoint: endpoints.labTests, nav: 'laboratory', title: 'Laboratory tests' },
  pharmacy: { label: 'Pharmacy', endpoint: endpoints.medicines, nav: 'pharmacy', title: 'Medicines' },
  billing: { label: 'Billing', endpoint: endpoints.invoices, nav: 'billing', title: 'Invoices' },
  staff: { label: 'Staff', endpoint: endpoints.staff } // API only - no SPA screen yet
};

export const MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

/**
 * Roles allowed to create/update in each module. Mirrors `authorize(...)` in backend/src/routes/index.ts
 * (the "Nurse" role exists in the API but has no E2E account, so it is not listed here).
 * Reads (GET) are open to every authenticated user.
 */
export const WRITE_ACCESS: Record<ModuleKey, RoleKey[]> = {
  patients: ['admin', 'doctor', 'receptionist'],
  doctors: ['admin', 'receptionist'],
  appointments: ['admin', 'doctor', 'receptionist'],
  medicalRecords: ['admin', 'doctor'],
  laboratory: ['admin', 'doctor', 'laboratory'],
  pharmacy: ['admin', 'pharmacist'],
  billing: ['admin', 'accountant', 'receptionist'],
  staff: ['admin']
};

/** Roles allowed to read GET /reports/dashboard. */
export const DASHBOARD_ACCESS: RoleKey[] = ['admin', 'accountant', 'doctor'];

/**
 * The modules each role must be able to work with, straight from the requirements.
 * Admin gets everything.
 */
export const REQUIRED_MODULES: Record<RoleKey, ModuleKey[]> = {
  admin: MODULE_KEYS,
  doctor: ['appointments', 'medicalRecords'],
  receptionist: ['patients', 'appointments'],
  laboratory: ['laboratory'],
  pharmacist: ['pharmacy'],
  accountant: ['billing']
};
