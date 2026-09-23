import { ModuleListPage } from './ModuleListPage';

export interface MedicalRecordForm { patientId: number | string; diagnosis: string; treatment: string }

export class MedicalRecordsPage extends ModuleListPage<MedicalRecordForm> {
  readonly path = '/medical-records';
  readonly apiPath = '/api/medical-records';
  readonly title = 'Medical records';
  readonly navItem = 'medical-records' as const;
}
