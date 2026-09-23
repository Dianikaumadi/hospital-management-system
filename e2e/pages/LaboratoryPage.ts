import { ModuleListPage } from './ModuleListPage';

export interface LabRequestForm { patientId: number | string; testName: string }

export class LaboratoryPage extends ModuleListPage<LabRequestForm> {
  readonly path = '/laboratory';
  readonly apiPath = '/api/laboratory/tests';
  readonly title = 'Laboratory tests';
  readonly navItem = 'laboratory' as const;
}
