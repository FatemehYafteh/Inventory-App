/**
 * Sends Telegram messages the bot did not get as a reply (a resent code, for example).
 * - Bot running (`api` is the bot's API client, `bot.api` in grammY): sends through it.
 * - No bot, like `mail.service` without SMTP: development writes the message to the log,
 *   tests keep it in `outbox`.
 * `send` never throws: a failed delivery is logged, and the person can ask for a new code.
 */
export function createTelegramMessenger(config, { api, logger = console } = {}) {
  const outbox = [];

  async function send(chatId, text) {
    const message = { chatId: String(chatId), text };
    if (!api) {
      if (config.isTest) outbox.push(message);
      else logger.info(`[telegram] To: ${message.chatId}\n${text}\n`);
      return;
    }
    try {
      await api.sendMessage(message.chatId, text);
    } catch (err) {
      logger.error(`[telegram] Delivery to ${message.chatId} failed: ${err.message}`);
    }
  }

  return { send, outbox };
}
