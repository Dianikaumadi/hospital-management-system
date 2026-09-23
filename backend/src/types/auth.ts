import { Request } from 'express';

export const ROLES = ['Admin', 'Doctor', 'Nurse', 'Receptionist', 'Laboratory Staff', 'Pharmacist', 'Accountant'] as const;
export type Role = typeof ROLES[number];

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
