import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { startBot } from '../../src/bot/bot.js';
import { AuthRequest } from '../../src/models/AuthRequest.js';
import { START_REPLIES } from '../../src/services/telegramAuth.service.js';
import { ORIGIN, buildApp, createUser, useTestDatabase } from '../helpers/setup.js';
import { botConfig, fakeBot } from '../helpers/telegram.js';

useTestDatabase();

const NINA = { id: 555000111, is_bot: false, first_name: 'Nina', last_name: 'Novak' };

let updateId = 0;
/** A text message from `from` (in their private chat by default), as Telegram delivers it. */
function messageUpdate(
  text,
  from = NINA,
  chat = { id: from.id, type: 'private', first_name: from.first_name },
) {
  updateId += 1;
  const command = text.match(/^\/\w+/);
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat,
      from,
      text,
      ...(command && {
        entities: [{ type: 'bot_command', offset: 0, length: command[0].length }],
      }),
    },
  };
}

async function startToken() {
  const res = await request(buildApp())
    .post('/api/auth/telegram/start')
    .set('Origin', ORIGIN)
    .set('X-Requested-With', 'XMLHttpRequest');
  return new URL(res.body.deepLink).searchParams.get('start');
}

/** Delivers a message to the bot and returns the reply it sent ({ chat_id, text }). */
async function send(bot, calls, text, from) {
  await bot.handleUpdate(messageUpdate(text, from));
  const reply = calls.at(-1);
  expect(reply.method).toBe('sendMessage');
  return reply.payload;
}

const { expired: EXPIRED, help: HELP } = START_REPLIES;

describe('startBot', () => {
  const webhookEnv = {
    APP_URL: 'https://inventory.example.com/',
    TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
    BOT_MODE: 'webhook',
  };
  const webhookConfig = botConfig(webhookEnv);
  const quiet = () => ({ info: vi.fn(), error: vi.fn() });

  it('registers the webhook at APP_URL with the secret token', async () => {
    const { bot, calls } = fakeBot(webhookConfig);

    await startBot(bot, webhookConfig, { logger: quiet() });

    expect(calls).toEqual([
      {
        method: 'setWebhook',
        payload: {
          url: 'https://inventory.example.com/api/telegram/webhook',
          secret_token: 'webhook-secret',
        },
      },
    ]);
  });

  it('logs an error when the webhook cannot be registered', async () => {
    const { bot } = fakeBot(webhookConfig, {
      respond: () => ({ ok: false, error_code: 400, description: 'Bad Request: bad url' }),
    });
    const logger = quiet();

    await startBot(bot, webhookConfig, { logger });

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('bad url'));
  });

  it('refuses to start when the token belongs to a different bot than the deep links name', async () => {
    const config = botConfig({ ...webhookEnv, TELEGRAM_BOT_USERNAME: 'other_bot' });
    const { bot, calls } = fakeBot(config);

    await expect(startBot(bot, config, { logger: quiet() })).rejects.toThrow(
      /TELEGRAM_BOT_USERNAME is @other_bot, but the token belongs to @test_bot/,
    );
    expect(calls).toEqual([]);
  });
});

describe('Telegram bot', () => {
  it('answers /start with a valid token with the code, in the same chat', async () => {
    const { bot, calls } = fakeBot(botConfig());
    const reply = await send(bot, calls, `/start ${await startToken()}`);

    expect(reply.chat_id).toBe(NINA.id);
    expect(reply.text).toMatch(
      /^Your sign-in code is \d{6}\. It expires in 2 minutes\. Only enter it on http:\/\/localhost:5173\. Never share it with anyone\.$/,
    );
  });

  it('says the link has expired for a used or unknown token', async () => {
    const { bot, calls } = fakeBot(botConfig());
    const token = await startToken();
    await send(bot, calls, `/start ${token}`);

    expect((await send(bot, calls, `/start ${token}`)).text).toBe(EXPIRED);
    expect((await send(bot, calls, '/start not-a-real-token')).text).toBe(EXPIRED);
  });

  it('explains how to sign in for /start without a token or any other message', async () => {
    const { bot, calls } = fakeBot(botConfig());

    expect((await send(bot, calls, '/start')).text).toBe(HELP);
    expect((await send(bot, calls, 'hello')).text).toBe(HELP);
    expect((await send(bot, calls, '/help')).text).toBe(HELP);
  });

  it('ignores groups, so a code is never posted where others can read it', async () => {
    const { bot, calls } = fakeBot(botConfig());
    const group = { id: -100123, type: 'group', title: 'Warehouse' };

    await bot.handleUpdate(messageUpdate(`/start ${await startToken()}`, NINA, group));

    expect(calls).toEqual([]);
  });

  it('sends no code to a rejected Telegram user', async () => {
    await createUser({ telegramId: String(NINA.id), status: 'rejected' });
    const { bot, calls } = fakeBot(botConfig());

    const reply = await send(bot, calls, `/start ${await startToken()}`);

    expect(reply.text).toBe('Access denied, contact an admin.');
    expect(calls.some((call) => /\d{6}/.test(call.payload.text))).toBe(false);
  });

  it('sends no code once the Telegram ID has had 5 codes this hour', async () => {
    await AuthRequest.create({
      requestId: 'earlier',
      startTokenHash: 'earlier-hash',
      status: 'otp_sent',
      telegramId: String(NINA.id),
      sendCount: 5,
      expiresAt: new Date(Date.now() + 60 * 1000),
    });
    const { bot, calls } = fakeBot(botConfig());

    const reply = await send(bot, calls, `/start ${await startToken()}`);

    expect(reply.text).toBe('Too many codes requested. Try again in an hour.');
  });
});
