import path from 'path';
import { env } from '../config/env';
import { AUTH_DIR } from '../config/paths';
import type { Role } from '../api/types';

export type RoleKey = 'admin' | 'doctor' | 'receptionist' | 'laboratory' | 'pharmacist' | 'accountant';

export interface TestUser {
  key: RoleKey;
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

const account = (key: RoleKey, role: Role, lastName: string): TestUser => ({
  key,
  role,
  firstName: 'E2E',
  lastName,
  email: `e2e.${key}@${env.emailDomain}`,
  password: env.userPassword
});

/** One dedicated account per role. Created (or reused) by global-setup. */
export const users: Record<RoleKey, TestUser> = {
  admin: account('admin', 'Admin', 'Admin'),
  doctor: account('doctor', 'Doctor', 'Doctor'),
  receptionist: account('receptionist', 'Receptionist', 'Receptionist'),
  laboratory: account('laboratory', 'Laboratory Staff', 'Laboratory'),
  pharmacist: account('pharmacist', 'Pharmacist', 'Pharmacist'),
  accountant: account('accountant', 'Accountant', 'Accountant')
};

export const ROLE_KEYS = Object.keys(users) as RoleKey[];

export const fullName = (user: TestUser): string => `${user.firstName} ${user.lastName}`;

/** Path of the pre-authenticated browser storage state written by global-setup. */
export const storageStatePath = (key: RoleKey): string => path.join(AUTH_DIR, `${key}.json`);

export const invalidCredentials = {
  wrongPassword: { email: users.admin.email, password: 'definitely-wrong-password' },
  unknownUser: { email: `nobody.${Date.now()}@${env.emailDomain}`, password: 'SomePassw0rd!' }
};
