import { app } from './app';
import { sequelize } from './config/database';
import './models';
import { env } from './config/env';

const start = async (): Promise<void> => {
  await sequelize.authenticate();
  await sequelize.sync();
  app.listen(env.port, () => console.log(`Hospital API listening on port ${env.port}`));
};

start().catch((error) => {
  console.error('Unable to start API', error);
  process.exit(1);
});
