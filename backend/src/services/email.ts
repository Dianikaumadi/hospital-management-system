import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { Role } from '../types/auth';

interface InvitationEmailInput {
  to: string;
  firstName: string;
  lastName: string;
  role: Role;
  activationUrl: string;
  expiresAt: Date;
}

interface EmailDeliveryResult {
  sent: boolean;
  reason?: 'not_configured' | 'send_failed';
}

const isEmailConfigured = (): boolean => Boolean(env.smtpHost && env.emailFrom);
const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const invitationText = ({ firstName, lastName, role, activationUrl, expiresAt }: InvitationEmailInput): string =>
  `Hello ${firstName} ${lastName},

You have been invited to CarePoint as ${role}.

Activate your account and create your password:
${activationUrl}

This invitation expires ${expiresAt.toUTCString()}.
`;

const invitationHtml = (input: InvitationEmailInput): string => {
  const firstName = escapeHtml(input.firstName);
  const lastName = escapeHtml(input.lastName);
  const role = escapeHtml(input.role);
  const activationUrl = escapeHtml(input.activationUrl);
  const expiresAt = escapeHtml(input.expiresAt.toUTCString());
  return `
    <div style="font-family: Arial, sans-serif; color: #172033; line-height: 1.5;">
      <h2 style="margin: 0 0 16px;">CarePoint account invitation</h2>
      <p>Hello ${firstName} ${lastName},</p>
      <p>You have been invited to CarePoint as <strong>${role}</strong>.</p>
      <p>
        <a href="${activationUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 700;">
          Activate account
        </a>
      </p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #2563eb;">${activationUrl}</p>
      <p style="color: #64748b;">This invitation expires ${expiresAt}.</p>
    </div>
  `;
};

export const sendInvitationEmail = async (input: InvitationEmailInput): Promise<EmailDeliveryResult> => {
  if (!isEmailConfigured()) return { sent: false, reason: 'not_configured' };

  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: env.smtpUser && env.smtpPass ? { user: env.smtpUser, pass: env.smtpPass } : undefined
  });

  try {
    await transporter.sendMail({
      from: env.emailFrom,
      to: input.to,
      subject: 'CarePoint account invitation',
      text: invitationText(input),
      html: invitationHtml(input)
    });
    return { sent: true };
  } catch (error) {
    console.error('Invitation email delivery failed', error);
    return { sent: false, reason: 'send_failed' };
  }
};
