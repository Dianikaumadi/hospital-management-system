import bcrypt from 'bcryptjs';
import { sequelize } from '../config/database';
import { User } from '../models';

// One-time bootstrap for the first administrator, since anonymous registration is disabled.
// Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run create-admin --workspace backend
const run = async (): Promise<void> => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD');
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');

  await sequelize.authenticate();
  await sequelize.sync();
  if (await User.findOne({ where: { email } })) {
    console.log(`User ${email} already exists; nothing to do.`);
    return;
  }
  await User.create({
    firstName: process.env.ADMIN_FIRST_NAME || 'System',
    lastName: process.env.ADMIN_LAST_NAME || 'Admin',
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'Admin',
    isActive: true
  });
  console.log(`Admin ${email} created.`);
};

run()
  .catch((error) => {
    console.error('Unable to create admin:', error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
