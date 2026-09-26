import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import routes from './routes';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/error';

export const app = express();
// Render/Vercel sit behind one reverse proxy; trust it so rate limiting keys on the real client IP.
app.set('trust proxy', 1);
app.use(cors({ origin: env.clientUrls }));
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: env.rateLimitMax }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
// Outside production the database host is reported so test tooling can refuse to run against a remote database.
const databaseHost = env.nodeEnv === 'production' ? undefined : new URL(env.databaseUrl).hostname;
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'hospital-management-api', databaseHost }));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);
