// Stands in for pressing Start in Telegram during development, when no bot is running.
// Prints the bot's reply, which holds the sign-in code.
// Usage: npm run tg:start -w server -- <startToken> <telegramId> "<name>" [username]
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { loadConfig } from '../src/config/env.js';
import { handleStart } from '../src/services/telegramAuth.service.js';

const [startToken, telegramId, name = '', username] = process.argv.slice(2);

if (!startToken || !/^\d+$/.test(telegramId ?? '')) {
  console.error(
    'Usage: npm run tg:start -w server -- <startToken> <telegramId> "<name>" [username]',
  );
  process.exit(1);
}

const config = loadConfig();
await connectDatabase(config.mongoUri);

const [firstName, ...rest] = name.trim().split(/\s+/);
const reply = await handleStart(
  { startToken, telegramId, firstName, lastName: rest.join(' '), username },
  config,
);
console.log(`[telegram] To: ${telegramId}${username ? ` (@${username})` : ''}\n${reply}`);

await disconnectDatabase();
