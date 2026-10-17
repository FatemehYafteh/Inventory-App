// Creates a verified email user so login can be tried before registration exists.
// Usage: npm run user:create -w server -- <email> <password> [name] [role] [status]
import { emailSchema, passwordSchema } from '@inventory/shared/schemas';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { loadConfig } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { hashPassword } from '../src/services/password.service.js';

const [rawEmail, password, name = 'Dev User', role = 'admin', status = 'active'] =
  process.argv.slice(2);

if (!rawEmail || !password) {
  console.error(
    'Usage: npm run user:create -w server -- <email> <password> [name] [role] [status]',
  );
  process.exit(1);
}

const email = emailSchema.parse(rawEmail);
const passwordCheck = passwordSchema.safeParse(password);
if (!passwordCheck.success) {
  console.error(passwordCheck.error.issues[0].message);
  process.exit(1);
}

const config = loadConfig();
await connectDatabase(config.mongoUri);

const user = await User.findOneAndUpdate(
  { email },
  {
    $set: {
      name,
      email,
      emailVerified: true,
      passwordHash: await hashPassword(password),
      role,
      status,
      failedLoginCount: 0,
    },
    $unset: { lockedUntil: 1 },
  },
  { upsert: true, new: true, runValidators: true },
);

console.log(`User ready: ${user.email} (${user.role}, ${user.status})`);
await disconnectDatabase();
