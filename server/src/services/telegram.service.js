/**
 * Sends Telegram messages the bot did not get as a reply (a resent code, for example).
 * Until the bot runs (issue #3), like `mail.service` without SMTP:
 * - development: writes the message to the log;
 * - tests: keeps messages in `outbox`.
 */
export function createTelegramMessenger(config, { logger = console } = {}) {
  const outbox = [];

  async function send(chatId, text) {
    const message = { chatId: String(chatId), text };
    if (config.isTest) outbox.push(message);
    else logger.info(`[telegram] To: ${message.chatId}\n${text}\n`);
  }

  return { send, outbox };
}
