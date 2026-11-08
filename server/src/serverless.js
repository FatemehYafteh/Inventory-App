import { createApp } from './app.js';
import { createBot } from './bot/bot.js';
import { startBotSafely } from './bot/startSafely.js';
import { connectDatabase } from './config/db.js';
import { loadConfig } from './config/env.js';
import { createTelegramMessenger } from './services/telegram.service.js';

let ready;

/**
 * Builds the app once per serverless instance (Vercel Functions) and reuses it, together with
 * its database connection, for every request the instance serves. Mirrors `index.js`, minus
 * `listen` and the shutdown hooks. The bot is set up in the background (getMe, the
 * TELEGRAM_BOT_USERNAME check and the webhook registration): a Telegram problem is logged and
 * never makes the whole API answer 503.
 */
export function getApp() {
  ready ??= (async () => {
    const config = loadConfig();
    if (config.isProduction && config.emailDelivery === 'log') {
      console.warn('[mail] EMAIL_DELIVERY=log: emails are written to this log, not sent.');
    }
    await connectDatabase(config.mongoUri, config.mongo);
    const bot = config.telegram.botToken ? createBot(config) : undefined;
    const telegram = createTelegramMessenger(config, { api: bot?.api });
    const app = createApp(config, { bot, telegram });
    if (bot) startBotSafely(bot, config);
    return app;
  })().catch((err) => {
    // Let the next request try again instead of failing forever.
    ready = undefined;
    throw err;
  });
  return ready;
}
