import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, AuthUser, Role } from '../types/auth';
import { AppError } from './error';
import { env } from '../config/env';

export const authenticate = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return next(new AppError(401, 'Authentication token is required'));
  try {
    req.user = jwt.verify(token, env.jwtSecret) as AuthUser;
    next();
  } catch {
    next(new AppError(401, 'Authentication token is invalid or expired'));
  }
};

export const authorize = (...roles: Role[]) => (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  if (!req.user || !roles.includes(req.user.role)) return next(new AppError(403, 'You do not have permission to perform this action'));
  next();
};
