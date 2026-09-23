import { uid } from '../utils/random';
import type { LabStatus } from '../api/types';

export interface LabTestInput { patientId: number; testName: string; requestedBy?: number }

export const buildLabTest = (patientId: number, overrides: Partial<LabTestInput> = {}): LabTestInput => ({
  patientId,
  testName: `E2E Complete Blood Count ${uid(5)}`,
  ...overrides
});

/** The laboratory workflow, in order. */
export const LAB_WORKFLOW: LabStatus[] = ['Requested', 'Collected', 'Processing', 'Completed'];
