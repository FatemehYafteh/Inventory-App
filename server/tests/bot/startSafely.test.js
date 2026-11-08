import { describe, expect, it, vi } from 'vitest';
import { startBotSafely } from '../../src/bot/startSafely.js';

const webhook = { telegram: { mode: 'webhook' } };
const polling = { telegram: { mode: 'polling' } };
const bot = {};

function logger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('startBotSafely', () => {
  it('starts the bot in webhook mode and resolves true', async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const log = logger();

    await expect(startBotSafely(bot, webhook, { logger: log, start })).resolves.toBe(true);
    expect(start).toHaveBeenCalledWith(bot, webhook, { logger: log });
    expect(log.error).not.toHaveBeenCalled();
  });

  it('logs a failed setup and resolves false instead of rejecting', async () => {
    const start = vi.fn().mockRejectedValue(new Error('TELEGRAM_BOT_USERNAME is @a, not @b'));
    const log = logger();

    await expect(startBotSafely(bot, webhook, { logger: log, start })).resolves.toBe(false);
    expect(log.error).toHaveBeenCalledWith(expect.stringMatching(/Bot setup failed.*@a, not @b/));
  });

  it('also survives a start function that throws synchronously', async () => {
    const start = vi.fn(() => {
      throw new Error('boom');
    });
    const log = logger();

    await expect(startBotSafely(bot, webhook, { logger: log, start })).resolves.toBe(false);
    expect(log.error).toHaveBeenCalledWith(expect.stringMatching(/boom/));
  });

  it('does not start long polling and says why', async () => {
    const start = vi.fn();
    const log = logger();

    await expect(startBotSafely(bot, polling, { logger: log, start })).resolves.toBe(false);
    expect(start).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith(expect.stringMatching(/BOT_MODE=webhook/));
  });
});
