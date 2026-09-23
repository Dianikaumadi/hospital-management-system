import { ModuleListPage } from './ModuleListPage';

export interface AppointmentForm {
  patientId: number | string;
  doctorId: number | string;
  startsAt: string;
  reason: string;
}

export class AppointmentsPage extends ModuleListPage<AppointmentForm> {
  readonly path = '/appointments';
  readonly apiPath = '/api/appointments';
  readonly title = 'Appointments';
  readonly navItem = 'appointments' as const;
}
