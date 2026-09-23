import type { PrescriptionItem } from '../api/types';

export interface MedicalRecordInput {
  patientId: number;
  doctorId?: number;
  diagnosis: string;
  treatment?: string;
  prescription?: PrescriptionItem[];
  reportUrl?: string;
}

export const buildPrescription = (): PrescriptionItem[] => [
  { medicine: 'Amoxicillin 500mg', dosage: '1 capsule', frequency: 'Three times daily', durationDays: 5 },
  { medicine: 'Paracetamol 650mg', dosage: '1 tablet', frequency: 'When required', durationDays: 3 }
];

export const buildMedicalRecord = (patientId: number, overrides: Partial<MedicalRecordInput> = {}): MedicalRecordInput => ({
  patientId,
  diagnosis: 'E2E Acute bronchitis',
  treatment: 'Rest, fluids and a five day antibiotic course',
  prescription: buildPrescription(),
  reportUrl: 'https://reports.hms-e2e.test/chest-xray-001.pdf',
  ...overrides
});
