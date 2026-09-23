import { RequestHandler } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from './error';

export const validate: RequestHandler = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError(422, 'Validation failed', errors.array()));
  next();
};
