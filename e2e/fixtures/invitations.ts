import { uid } from '../utils/random';
import { env } from '../config/env';
import type { Role } from '../api/types';

export interface InvitationInput { firstName: string; lastName: string; email: string; role: Role }

/** Builds a unique staff invitation. Role defaults to Receptionist, matching the UI form's default. */
export const buildInvitation = (overrides: Partial<InvitationInput> = {}): InvitationInput => {
  const id = uid();
  return {
    firstName: `E2E${id}`,
    lastName: 'Invitee',
    email: `e2e.invite.${id}@${env.emailDomain}`,
    role: 'Receptionist',
    ...overrides
  };
};
