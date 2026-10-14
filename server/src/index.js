import { createApp } from './app.js';
import { createBot, startBot } from './bot/bot.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { loadConfig } from './config/env.js';
import { createTelegramMessenger } from './services/telegram.service.js';

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  await connectDatabase(config.mongoUri);
  // Without a token (development only) the server logs start tokens and codes instead,
  // and `npm run tg:start` stands in for pressing Start.
  const bot = config.telegram.botToken ? createBot(config) : undefined;
  const telegram = createTelegramMessenger(config, { api: bot?.api });
  const app = createApp(config, { bot, telegram });
  const server = app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });

  if (bot) await startBot(bot, config);

  const shutdown = async () => {
    server.close();
    if (bot?.isRunning()) await bot.stop();
    await app.locals.mailer.idle();
    await disconnectDatabase();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
