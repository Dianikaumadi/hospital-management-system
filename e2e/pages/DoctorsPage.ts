import { ModuleListPage } from './ModuleListPage';

export interface DoctorForm {
  userId: number | string;
  specialization: string;
  department: string;
  licenseNumber: string;
  consultationFee: number | string;
}

export class DoctorsPage extends ModuleListPage<DoctorForm> {
  readonly path = '/doctors';
  readonly apiPath = '/api/doctors';
  readonly title = 'Doctors';
  readonly navItem = 'doctors' as const;
}
