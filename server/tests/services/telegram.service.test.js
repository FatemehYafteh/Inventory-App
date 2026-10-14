import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../src/config/env.js';
import { createTelegramMessenger } from '../../src/services/telegram.service.js';
import { testConfig, testEnv } from '../helpers/setup.js';

const devConfig = loadConfig({ ...testEnv, NODE_ENV: 'development' });

describe('createTelegramMessenger', () => {
  it('sends through the bot API when a bot is running', async () => {
    const api = { sendMessage: vi.fn().mockResolvedValue({}) };
    const messenger = createTelegramMessenger(testConfig, { api });

    await messenger.send(555000111, 'Your sign-in code is 123456.');

    expect(api.sendMessage).toHaveBeenCalledWith('555000111', 'Your sign-in code is 123456.');
  });

  it('logs a failed delivery instead of throwing', async () => {
    const api = { sendMessage: vi.fn().mockRejectedValue(new Error('Forbidden: bot was blocked')) };
    const logger = { info: vi.fn(), error: vi.fn() };
    const messenger = createTelegramMessenger(testConfig, { api, logger });

    await expect(messenger.send('555000111', 'code')).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('bot was blocked'));
  });

  it('logs the message in development when no bot runs', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const messenger = createTelegramMessenger(devConfig, { logger });

    await messenger.send('555000111', 'Your sign-in code is 123456.');

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Your sign-in code is 123456.'),
    );
  });
});
