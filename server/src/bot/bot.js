import { Bot } from 'grammy';
import { START_REPLIES, handleStart } from '../services/telegramAuth.service.js';

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
    const { id, first_name: firstName, last_name: lastName, username } = ctx.from;
    const reply = await handleStart(
      { startToken: ctx.match.trim(), telegramId: id, firstName, lastName, username },
      config,
    );
    await ctx.reply(reply);
  });

  privateChats.on('message', (ctx) => ctx.reply(START_REPLIES.help));

  return bot;
}

/**
 * Starts receiving updates. `polling`: long polling, for development. `webhook`: registers
 * APP_URL/api/telegram/webhook with Telegram (the route itself is in `app.js`); a failure
 * to register is logged, and the API keeps serving.
 * Throws (so startup fails) when the token is bad or belongs to another bot than
 * TELEGRAM_BOT_USERNAME.
 */
export async function startBot(bot, config, { logger = console } = {}) {
  // getMe, so a bad token fails startup instead of every webhook call, and deep links never
  // name a bot other than the one that receives the start token.
  await bot.init();
  const actual = bot.botInfo.username;
  const configured = config.telegram.botUsername;
  if (actual.toLowerCase() !== configured?.toLowerCase()) {
    throw new Error(
      `TELEGRAM_BOT_USERNAME is @${configured ?? '(not set)'}, but the token belongs to @${actual}`,
    );
  }

  if (config.telegram.mode === 'webhook') {
    const url = `${config.appUrl}/api/telegram/webhook`;
    try {
      await bot.api.setWebhook(url, { secret_token: config.telegram.webhookSecret });
      logger.info(`[telegram] Webhook registered at ${url}`);
    } catch (err) {
      logger.error(`[telegram] Could not register the webhook at ${url}: ${err.message}`);
    }
    return;
  }

  // Runs until the bot stops (grammY removes any registered webhook first).
  bot
    .start({ onStart: (me) => logger.info(`[telegram] Bot @${me.username} is polling`) })
    .catch((err) => logger.error(`[telegram] Polling stopped: ${err.message}`));
}
