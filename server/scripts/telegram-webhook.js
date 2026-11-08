// Registers the Telegram webhook once for APP_URL (the deployed address). Run it after the
// first deploy and whenever APP_URL or TELEGRAM_WEBHOOK_SECRET changes; the registration stays
// at Telegram, so the API does not repeat it on every cold start.
//   npm run tg:webhook -w server
// Needs TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET and APP_URL with the
// production values (set them in the shell for this run, or in server/.env).
import { createBot, initBot, registerWebhook } from '../src/bot/bot.js';
import { loadConfig } from '../src/config/env.js';

const config = loadConfig();
if (!config.telegram.botToken || !config.telegram.webhookSecret) {
  console.error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET first.');
  process.exit(1);
}

const bot = createBot(config);
await initBot(bot, config);
const url = await registerWebhook(bot, config);
console.log(`Telegram sends @${bot.botInfo.username} updates to ${url}`);
