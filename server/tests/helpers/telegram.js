import { createBot } from '../../src/bot/bot.js';
import { loadConfig } from '../../src/config/env.js';
import { testEnv } from './setup.js';

/** What getMe would return for the test bot (passing it skips that call). */
export const BOT_INFO = {
  id: 42,
  is_bot: true,
  first_name: 'Inventory',
  username: 'test_bot',
  can_join_groups: false,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
};

/** Test config with a bot token, plus any env overrides. */
export function botConfig(overrides = {}) {
  return loadConfig({ ...testEnv, TELEGRAM_BOT_TOKEN: '123:test-token', ...overrides });
}

/**
 * A bot whose Telegram API calls are recorded in `calls` instead of sent. Every call
 * answers with `respond(method, payload)` (default: success).
 */
export function fakeBot(config, { respond = () => ({ ok: true, result: true }), logger } = {}) {
  const bot = createBot(config, { botInfo: BOT_INFO, logger });
  const calls = [];
  bot.api.config.use((_prev, method, payload) => {
    calls.push({ method, payload });
    return Promise.resolve(respond(method, payload));
  });
  return { bot, calls };
}
