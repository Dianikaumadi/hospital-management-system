import { uid } from '../utils/random';

export const DEPARTMENTS = ['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics'] as const;
export const SPECIALIZATIONS = ['Interventional Cardiology', 'Neurosurgery', 'Neonatology', 'Sports Medicine'] as const;

export interface DoctorInput {
  userId: number;
  specialization: string;
  department: string;
  licenseNumber: string;
  consultationFee: string;
}

/**
 * `userId` must reference an existing user (the doctor login account). The department is unique
 * and lowercase so the exact-match department search can find exactly this doctor.
 */
export const buildDoctor = (userId: number, overrides: Partial<DoctorInput> = {}): DoctorInput => {
  const id = uid();
  return {
    userId,
    specialization: 'Cardiology',
    department: `e2e-dept-${id}`,
    licenseNumber: `e2e-lic-${id}`,
    consultationFee: '500',
    ...overrides
  };
};
