import { futureSlot } from '../utils/dates';
import type { AppointmentStatus } from '../api/types';

export interface AppointmentInput { patientId: number; doctorId: number; startsAt: string; reason: string }

export const buildAppointment = (patientId: number, doctorId: number, overrides: Partial<AppointmentInput> = {}): AppointmentInput => ({
  patientId,
  doctorId,
  startsAt: futureSlot(7 + Math.floor(Math.random() * 20), 9 + Math.floor(Math.random() * 8)),
  reason: 'E2E routine check-up',
  ...overrides
});

/** Every status the appointment workflow must support. */
export const APPOINTMENT_STATUSES: AppointmentStatus[] = ['Scheduled', 'Completed', 'Cancelled', 'No-show'];
