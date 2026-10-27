import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.js';

const base = {
  NODE_ENV: 'development',
  MONGODB_URI: 'mongodb://localhost:27017/inventory?replicaSet=rs0',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  CLIENT_ORIGIN: 'http://localhost:5173',
  APP_URL: 'http://localhost:5173',
};

const production = {
  ...base,
  NODE_ENV: 'production',
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  EMAIL_FROM: 'no-reply@example.com',
  TELEGRAM_BOT_TOKEN: '123:abc',
  TELEGRAM_BOT_USERNAME: 'inventory_bot',
  TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
  BOT_MODE: 'webhook',
};

describe('loadConfig', () => {
  it('accepts a valid development config without SMTP', () => {
    const config = loadConfig(base);
    expect(config.smtp).toBeNull();
    expect(config.cookieSecure).toBe(false);
    expect(config.trustProxy).toBe(0);
  });

  it('reads the number of proxies in front of the API', () => {
    expect(loadConfig({ ...base, TRUST_PROXY: '1' }).trustProxy).toBe(1);
    expect(() => loadConfig({ ...base, TRUST_PROXY: 'yes' })).toThrow(/TRUST_PROXY/);
  });

  it('fails with the names of missing required variables', () => {
    const { MONGODB_URI: _uri, JWT_ACCESS_SECRET: _secret, ...rest } = base;
    expect(() => loadConfig(rest)).toThrow(/MONGODB_URI[\s\S]*JWT_ACCESS_SECRET/);
  });

  it('rejects short JWT secrets', () => {
    expect(() => loadConfig({ ...base, JWT_REFRESH_SECRET: 'short' })).toThrow(
      /JWT_REFRESH_SECRET/,
    );
  });

  it('requires SMTP settings in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/SMTP_HOST/);
  });

  it('accepts a Brevo API key instead of SMTP in production', () => {
    const {
      SMTP_HOST: _host,
      SMTP_USER: _user,
      SMTP_PASS: _pass,
      ...rest
    } = production;
    const config = loadConfig({ ...rest, BREVO_API_KEY: 'xkeysib-123' });
    expect(config.brevo).toEqual({ apiKey: 'xkeysib-123', from: 'no-reply@example.com' });
    expect(config.smtp).toBeNull();
  });

  it('still requires EMAIL_FROM with a Brevo API key', () => {
    const { EMAIL_FROM: _from, ...rest } = production;
    expect(() => loadConfig({ ...rest, BREVO_API_KEY: 'xkeysib-123' })).toThrow(/EMAIL_FROM/);
  });

  it('runs without an email provider in production when EMAIL_DELIVERY=log', () => {
    const {
      SMTP_HOST: _host,
      SMTP_USER: _user,
      SMTP_PASS: _pass,
      EMAIL_FROM: _from,
      ...rest
    } = production;
    const config = loadConfig({ ...rest, EMAIL_DELIVERY: 'log' });
    expect(config.emailDelivery).toBe('log');
    expect(config.smtp).toBeNull();
    expect(config.brevo).toBeNull();
  });

  it('ignores provider settings when EMAIL_DELIVERY=log', () => {
    const config = loadConfig({ ...production, BREVO_API_KEY: 'k', EMAIL_DELIVERY: 'log' });
    expect(config.smtp).toBeNull();
    expect(config.brevo).toBeNull();
  });

  it('forces Secure cookies in production', () => {
    const config = loadConfig({ ...production, COOKIE_SECURE: 'false' });
    expect(config.cookieSecure).toBe(true);
  });

  it('requires the Telegram bot settings in production', () => {
    const {
      TELEGRAM_BOT_TOKEN: _token,
      TELEGRAM_BOT_USERNAME: _username,
      TELEGRAM_WEBHOOK_SECRET: _secret,
      ...rest
    } = production;
    expect(() => loadConfig(rest)).toThrow(
      /TELEGRAM_BOT_TOKEN[\s\S]*TELEGRAM_BOT_USERNAME[\s\S]*TELEGRAM_WEBHOOK_SECRET/,
    );
  });

  it('requires a webhook secret whenever the bot runs as a webhook', () => {
    expect(() =>
      loadConfig({ ...base, TELEGRAM_BOT_TOKEN: '123:abc', BOT_MODE: 'webhook' }),
    ).toThrow(/TELEGRAM_WEBHOOK_SECRET/);
  });

  it('uses the webhook in production', () => {
    expect(() => loadConfig({ ...production, BOT_MODE: 'polling' })).toThrow(/BOT_MODE/);
  });

  it('accepts only webhook secrets Telegram accepts', () => {
    expect(() => loadConfig({ ...production, TELEGRAM_WEBHOOK_SECRET: 'has spaces!' })).toThrow(
      /TELEGRAM_WEBHOOK_SECRET/,
    );
    expect(() => loadConfig({ ...production, TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(257) })).toThrow(
      /TELEGRAM_WEBHOOK_SECRET/,
    );
  });

  it('runs without a bot in development', () => {
    expect(loadConfig(base).telegram).toMatchObject({ botToken: undefined, mode: 'polling' });
  });
});
