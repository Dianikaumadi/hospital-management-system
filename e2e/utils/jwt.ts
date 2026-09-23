export interface JwtPayload { id: number; email: string; role: string; firstName: string; lastName: string; exp: number; iat: number }

/** Decodes (does not verify) a JWT payload so tests can assert claims. */
export const decodeJwt = (token: string): JwtPayload =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
