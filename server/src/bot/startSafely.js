import { waitUntil } from '../utils/waitUntil.js';
import { startBot } from './bot.js';

/**
 * Sets the bot up on a serverless instance (Vercel) without ever taking the API down.
 * - Runs in the background: the cold start does not wait for Telegram (getMe, setWebhook).
 * - A failure (Telegram unreachable, a bad token, a token for another bot than
 *   TELEGRAM_BOT_USERNAME) is logged as an error and the rest of the API keeps serving.
 *   Webhook calls then retry `bot.init()` on their own (grammY does this for an uninitialised
 *   bot), and sign-in with Telegram works again once Telegram answers.
 * - Long polling cannot run in a serverless function, so BOT_MODE=polling is reported and
 *   the bot is not started.
 * Resolves to true when the bot is set up, false otherwise. Never rejects.
 */
export function startBotSafely(bot, config, { logger = console, start = startBot } = {}) {
  if (config.telegram.mode !== 'webhook') {
    logger.error(
      '[telegram] BOT_MODE=polling cannot work in a serverless function. Set ' +
        'BOT_MODE=webhook; until then the bot does not answer.',
    );
    return Promise.resolve(false);
  }

  let job;
  try {
    job = Promise.resolve(start(bot, config, { logger }));
  } catch (err) {
    job = Promise.reject(err);
  }
  return waitUntil(
    job.then(
      () => true,
      (err) => {
        logger.error(`[telegram] Bot setup failed; the API keeps serving: ${err.message}`);
        return false;
      },
    ),
  );
}
