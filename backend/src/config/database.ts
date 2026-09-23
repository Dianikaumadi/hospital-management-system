import { Sequelize } from 'sequelize';
import { env } from './env';

export const sequelize = new Sequelize(env.databaseUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: env.databaseSsl ? { ssl: { require: true, rejectUnauthorized: true } } : undefined,
  pool: {
    max: 10,
    min: 0,
    acquire: 30_000,
    idle: 10_000
  }
});
