import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../src/config/env.js';
import { createApp } from '../../src/app.js';
import { createMailer } from '../../src/services/mail.service.js';
import { resetPasswordTemplate } from '../../src/services/mail.templates.js';
import { testEnv } from '../helpers/setup.js';

// A real reset link, built the way auth.service builds it.
const SECRET_TOKEN = 'SECRET-RESET-TOKEN-abc123';
const link = `https://app.example.com/reset-password?token=${SECRET_TOKEN}`;
const message = {
  to: 'victim@example.com',
  ...resetPasswordTemplate({ name: 'Vic', link, hasPassword: true }, 'en'),
};

const production = {
  ...testEnv,
  NODE_ENV: 'production',
  BOT_MODE: 'webhook',
  TELEGRAM_BOT_TOKEN: '123:abc',
  TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
  EMAIL_DELIVERY: 'log',
  COOKIE_SECURE: 'true',
};

function logged(config) {
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
  return { logger, mailer: createMailer(config, { logger }) };
}
const everything = (logger) =>
  [...logger.info.mock.calls, ...logger.error.mock.calls, ...logger.warn.mock.calls]
    .flat()
    .join('\n');

describe('email log mode never writes a reset link to a production log', () => {
  it('production + EMAIL_DELIVERY=log: logs that a mail was held back, but not the link or token', async () => {
    const config = loadConfig(production);
    expect(config.emailDelivery).toBe('log');
    const { logger, mailer } = logged(config);

    await mailer.send(message);

    const output = everything(logger);
    expect(output).toContain('victim@example.com');
    expect(output).not.toContain(SECRET_TOKEN);
    expect(output).not.toContain('reset-password?token');
    expect(output).not.toContain('https://app.example.com');
  });

  it('the same holds through sendInBackground, which is what the auth flows use', async () => {
    const { logger, mailer } = logged(loadConfig(production));

    mailer.sendInBackground(message);
    await mailer.idle();

    expect(everything(logger)).not.toContain(SECRET_TOKEN);
  });

  it('development keeps logging the full email, links included (that is its purpose)', async () => {
    const { logger, mailer } = logged(loadConfig({ ...testEnv, NODE_ENV: 'development' }));
    // loadConfig marks development as non-test, so the mailer logs instead of using the outbox.
    await mailer.send(message);
    expect(everything(logger)).toContain(SECRET_TOKEN);
  });

  it('the app still starts in production log mode (a demo deployment with no email provider)', () => {
    expect(() => createApp(loadConfig(production))).not.toThrow();
  });
});
