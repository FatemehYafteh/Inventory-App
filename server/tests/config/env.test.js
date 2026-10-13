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

describe('loadConfig', () => {
  it('accepts a valid development config without SMTP', () => {
    const config = loadConfig(base);
    expect(config.smtp).toBeNull();
    expect(config.cookieSecure).toBe(false);
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

  it('forces Secure cookies in production', () => {
    const config = loadConfig({
      ...base,
      NODE_ENV: 'production',
      COOKIE_SECURE: 'false',
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
      EMAIL_FROM: 'no-reply@example.com',
    });
    expect(config.cookieSecure).toBe(true);
  });
});
