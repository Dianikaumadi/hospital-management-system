/** REST paths, relative to `<api>/api/`. */
export const endpoints = {
  login: 'auth/login',
  register: 'auth/register',
  me: 'auth/me',
  patients: 'patients',
  doctors: 'doctors',
  appointments: 'appointments',
  medicalRecords: 'medical-records',
  labTests: 'laboratory/tests',
  medicines: 'pharmacy/medicines',
  invoices: 'billing/invoices',
  staff: 'staff',
  dashboard: 'reports/dashboard'
} as const;

export const patientDocuments = (patientId: number): string => `patients/${patientId}/documents`;
