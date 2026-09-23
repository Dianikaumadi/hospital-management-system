import { ModuleListPage } from './ModuleListPage';
import type { patientFormFields } from '../fixtures/patients';

export type PatientForm = ReturnType<typeof patientFormFields>;

export class PatientsPage extends ModuleListPage<PatientForm> {
  readonly path = '/patients';
  readonly apiPath = '/api/patients';
  readonly title = 'Patients';
  readonly navItem = 'patients' as const;
}
