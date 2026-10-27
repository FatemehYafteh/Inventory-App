import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { START_REPLIES } from '../../src/services/telegramAuth.service.js';
import { useTestDatabase } from '../helpers/setup.js';
import { botConfig, fakeBot } from '../helpers/telegram.js';

useTestDatabase();

const SECRET = 'webhook-secret-for-tests';
const webhookConfig = botConfig({ TELEGRAM_WEBHOOK_SECRET: SECRET, BOT_MODE: 'webhook' });

function webhookApp(config = webhookConfig, options = {}) {
  const { bot, calls } = fakeBot(config, options);
  return { app: createApp(config, { bot }), calls };
}

const update = {
  update_id: 1,
  message: {
    message_id: 1,
    date: Math.floor(Date.now() / 1000),
    chat: { id: 555000111, type: 'private', first_name: 'Nina' },
    from: { id: 555000111, is_bot: false, first_name: 'Nina' },
    text: 'hello',
  },
};

// Telegram sends neither an Origin nor X-Requested-With: the secret header is the check.
function deliver(app, secret) {
  const req = request(app).post('/api/telegram/webhook');
  if (secret) req.set('X-Telegram-Bot-Api-Secret-Token', secret);
  return req.send(update);
}

describe('POST /api/telegram/webhook', () => {
  it('handles an update that carries the secret token', async () => {
    const { app, calls } = webhookApp();

    const res = await deliver(app, SECRET);

    expect(res.status).toBe(200);
    expect(calls).toEqual([
      { method: 'sendMessage', payload: { chat_id: 555000111, text: START_REPLIES.help } },
    ]);
  });

  it('refuses an update with a missing or wrong secret token', async () => {
    const { app, calls } = webhookApp();

    expect((await deliver(app)).status).toBe(401);
    expect((await deliver(app, 'wrong-secret')).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('answers 200 when handling fails, so Telegram does not deliver the update again', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const { app } = webhookApp(webhookConfig, {
      logger,
      respond: () => ({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked' }),
    });

    const res = await deliver(app, SECRET);

    expect(res.status).toBe(200);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('bot was blocked'));
  });

  it('does not exist when the bot uses polling', async () => {
    const { app, calls } = webhookApp(botConfig());

    expect((await deliver(app, SECRET)).status).toBe(403);
    expect(calls).toEqual([]);
  });
});
