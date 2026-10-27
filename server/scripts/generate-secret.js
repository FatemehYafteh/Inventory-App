// Prints a random hex secret for .env values (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ...).
// Usage: npm run secret:generate -w server -- [bytes]
import { generateSecret } from '../src/utils/crypto.js';

const bytes = Number(process.argv[2] ?? 32);

if (!Number.isInteger(bytes) || bytes < 16) {
  console.error('Usage: npm run secret:generate -w server -- [bytes]  (integer, at least 16)');
  process.exit(1);
}

console.log(generateSecret(bytes));
