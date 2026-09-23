import { uid } from '../utils/random';
import type { Patient } from '../api/types';

export type PatientInput = Pick<Patient, 'medicalRecordNumber' | 'firstName' | 'lastName' | 'dateOfBirth' | 'gender' | 'phone'>
  & Partial<Pick<Patient, 'email' | 'address' | 'bloodGroup' | 'emergencyContact'>>;

/**
 * Builds unique patient data. The MRN is lowercase on purpose: the API lowercases the search
 * term and compares it to medical_record_number exactly.
 */
export const buildPatient = (overrides: Partial<PatientInput> = {}): PatientInput => {
  const id = uid();
  return {
    medicalRecordNumber: `e2e-${id}`,
    firstName: `E2E${id}`,
    lastName: 'Patient',
    dateOfBirth: '1990-05-15',
    gender: 'Female',
    phone: '+91 98765 43210',
    email: `patient.${id}@hms-e2e.test`,
    address: '12 Test Street, Testville',
    bloodGroup: 'O+',
    emergencyContact: 'Sam Contact +91 90000 00000',
    ...overrides
  };
};

/** The subset of fields exposed by the "Add Patient" form in the UI. */
export const patientFormFields = (p: PatientInput) => ({
  medicalRecordNumber: p.medicalRecordNumber,
  firstName: p.firstName,
  lastName: p.lastName,
  dateOfBirth: p.dateOfBirth,
  gender: p.gender,
  phone: p.phone
});
