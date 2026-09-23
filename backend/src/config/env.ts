import 'dotenv/config';

const required = (name: string, fallback?: string): string => {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const databaseUrl = required('DATABASE_URL').replace(/([?&])sslmode=require\b/gi, '$1sslmode=verify-full');

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl,
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || (process.env.SMTP_SECURE === 'true' ? 465 : 587)),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  emailFrom: process.env.EMAIL_FROM,
  // Abuse protection matters in production (300 requests / 15 min / IP). Elsewhere it would lock out
  // automated suites after a few dozen tests, so it is effectively off unless RATE_LIMIT_MAX is set.
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 300 : 100_000)),
  invitationExpiresHours: Number(process.env.INVITATION_EXPIRES_HOURS || 72),
  databaseSsl: process.env.DATABASE_SSL === 'true' || process.env.DATABASE_URL?.includes('neon.tech') === true || process.env.NODE_ENV === 'production'
};
