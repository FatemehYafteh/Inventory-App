import { describe, expect, it, vi } from 'vitest';
import { createBrevoTransport, parseSender } from '../../src/services/brevo.transport.js';
import { createMailer } from '../../src/services/mail.service.js';
import { testConfig } from '../helpers/setup.js';

const message = {
  from: 'Inventory <me@example.com>',
  to: 'a@example.com',
  subject: 'Hello',
  text: 'Link: http://x/y',
  html: '<p>Link</p>',
};

const reply = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

describe('brevo.transport', () => {
  it('parses the sender in every EMAIL_FROM shape', () => {
    expect(parseSender('Inventory <me@example.com>')).toEqual({
      name: 'Inventory',
      email: 'me@example.com',
    });
    expect(parseSender('"Inventory App" <me@example.com>')).toEqual({
      name: 'Inventory App',
      email: 'me@example.com',
    });
    expect(parseSender('<me@example.com>')).toEqual({ email: 'me@example.com' });
    expect(parseSender('me@example.com')).toEqual({ email: 'me@example.com' });
  });

  it('posts the message to the Brevo API with the key', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(201, { messageId: 'x' }));
    await createBrevoTransport({ apiKey: 'key-1', fetch }).sendMail(message);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('key-1');
    expect(JSON.parse(init.body)).toEqual({
      sender: { name: 'Inventory', email: 'me@example.com' },
      to: [{ email: 'a@example.com' }],
      subject: 'Hello',
      textContent: 'Link: http://x/y',
      htmlContent: '<p>Link</p>',
    });
  });

  it('marks network errors, 429 and 5xx as transient, so the mailer retries them', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(reply(429))
      .mockResolvedValueOnce(reply(503))
      .mockResolvedValueOnce(reply(201));
    const mailer = createMailer(
      { ...testConfig, isTest: false },
      { transport: createBrevoTransport({ apiKey: 'k', fetch }), retryDelaysMs: [0, 0, 0] },
    );

    await mailer.send(message);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('does not retry other 4xx answers', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(401, { message: 'Key not found' }));
    const mailer = createMailer(
      { ...testConfig, isTest: false },
      { transport: createBrevoTransport({ apiKey: 'k', fetch }), retryDelaysMs: [0, 0] },
    );

    await expect(mailer.send(message)).rejects.toThrow(/401/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
