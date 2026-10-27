import { createApp } from './app.js';
import { createBot, startBot } from './bot/bot.js';
import { connectDatabase } from './config/db.js';
import { loadConfig } from './config/env.js';
import { createTelegramMessenger } from './services/telegram.service.js';

let ready;

/**
 * Builds the app once per serverless instance (Vercel Functions) and reuses it, together with
 * its database connection, for every request the instance serves. Mirrors `index.js`, minus
 * `listen` and the shutdown hooks. In webhook mode the webhook is (re)registered on each cold
 * start, which also checks the token against TELEGRAM_BOT_USERNAME.
 */
export function getApp() {
  ready ??= (async () => {
    const config = loadConfig();
    if (config.isProduction && config.emailDelivery === 'log') {
      console.warn('[mail] EMAIL_DELIVERY=log: emails are written to this log, not sent.');
    }
    await connectDatabase(config.mongoUri);
    const bot = config.telegram.botToken ? createBot(config) : undefined;
    const telegram = createTelegramMessenger(config, { api: bot?.api });
    if (bot) await startBot(bot, config);
    return createApp(config, { bot, telegram });
  })().catch((err) => {
    // Let the next request try again instead of failing forever.
    ready = undefined;
    throw err;
  });
  return ready;
}
