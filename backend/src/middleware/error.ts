import { ErrorRequestHandler, RequestHandler } from 'express';

export class AppError extends Error {
  constructor(public statusCode: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, `Route not found: ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof AppError ? error.message : 'An unexpected server error occurred';
  if (statusCode === 500) console.error(error);
  res.status(statusCode).json({ success: false, message, details: error instanceof AppError ? error.details : undefined });
};
