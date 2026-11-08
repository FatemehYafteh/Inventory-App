import { Bot } from 'grammy';
import { handleStart, replyLanguage, startReply } from '../services/telegramAuth.service.js';

/**
 * The Telegram bot. It handles only `/start <token>` (the reply is the sign-in code or a
 * short status message) and answers anything else with how to sign in.
 * Private chats only, so a code is never posted into a group.
 * `botInfo` skips the getMe call (tests pass a fixed one).
 */
export function createBot(config, { botInfo, logger = console } = {}) {
  const bot = new Bot(config.telegram.botToken, { botInfo });
  // Handled here rather than by `bot.catch`, which only covers long polling: a webhook call
  // that failed would be delivered again, and a second /start says the link has expired.
  const logError = ({ error }) => logger.error(`[telegram] Update failed: ${error.message}`);
  const privateChats = bot.errorBoundary(logError).chatType('private');

  privateChats.command('start', async (ctx) => {
    const {
      id,
      first_name: firstName,
      last_name: lastName,
      username,
      language_code: languageCode,
    } = ctx.from;
    const reply = await handleStart(
      { startToken: ctx.match.trim(), telegramId: id, firstName, lastName, username, languageCode },
      config,
    );
    await ctx.reply(reply);
  });

  privateChats.on('message', async (ctx) => {
    const language = await replyLanguage(ctx.from.id, ctx.from.language_code);
    await ctx.reply(startReply('help', language));
  });

  return bot;
}

/**
 * Fetches the bot's own info (getMe) and checks it against TELEGRAM_BOT_USERNAME, so deep links
 * never name a bot other than the one that receives the start token. Throws on a bad token or a
 * mismatch. Makes no change at Telegram.
 */
export async function initBot(bot, config) {
  await bot.init();
  const actual = bot.botInfo.username;
  const configured = config.telegram.botUsername;
  if (actual.toLowerCase() !== configured?.toLowerCase()) {
    throw new Error(
      `TELEGRAM_BOT_USERNAME is @${configured ?? '(not set)'}, but the token belongs to @${actual}`,
    );
  }
}

/** The URL Telegram sends updates to in webhook mode. */
export function webhookUrl(config) {
  return `${config.appUrl}/api/telegram/webhook`;
}

/**
 * Tells Telegram to send updates to APP_URL/api/telegram/webhook with the secret token. The
 * registration stays at Telegram until changed, so it is needed once per address (see
 * `npm run tg:webhook -w server`). Throws when Telegram refuses.
 */
export async function registerWebhook(bot, config, { logger = console } = {}) {
  const url = webhookUrl(config);
  await bot.api.setWebhook(url, { secret_token: config.telegram.webhookSecret });
  logger.info(`[telegram] Webhook registered at ${url}`);
  return url;
}

/**
 * Starts receiving updates on a long-running server (`index.js`). `polling`: long polling, for
 * development. `webhook`: registers the webhook; a failure to register is logged, and the API
 * keeps serving.
 * Throws (so startup fails) when the token is bad or belongs to another bot than
 * TELEGRAM_BOT_USERNAME.
 */
export async function startBot(bot, config, { logger = console } = {}) {
  await initBot(bot, config);

  if (config.telegram.mode === 'webhook') {
    try {
      await registerWebhook(bot, config, { logger });
    } catch (err) {
      logger.error(
        `[telegram] Could not register the webhook at ${webhookUrl(config)}: ${err.message}`,
      );
    }
    return;
  }

  // Runs until the bot stops (grammY removes any registered webhook first).
  bot
    .start({ onStart: (me) => logger.info(`[telegram] Bot @${me.username} is polling`) })
    .catch((err) => logger.error(`[telegram] Polling stopped: ${err.message}`));
}
