import { describe, expect, it, vi } from 'vitest';
import { createMailer } from '../../src/services/mail.service.js';
import { verifyEmailTemplate } from '../../src/services/mail.templates.js';
import { testConfig } from '../helpers/setup.js';

const devConfig = { ...testConfig, isTest: false, nodeEnv: 'development', smtp: null };
const message = { to: 'a@example.com', subject: 'Hello', text: 'Link: http://x/y', html: '<p>' };

function fakeLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

describe('mail.service', () => {
  it('logs the email and its links when SMTP is not configured', async () => {
    const logger = fakeLogger();
    await createMailer(devConfig, { logger }).send(message);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Link: http://x/y'));
  });

  it('retries transient failures and then succeeds', async () => {
    const sendMail = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
      .mockRejectedValueOnce(Object.assign(new Error('try later'), { responseCode: 451 }))
      .mockResolvedValueOnce({});
    const mailer = createMailer(devConfig, {
      transport: { sendMail },
      retryDelaysMs: [0, 0],
      logger: fakeLogger(),
    });

    await mailer.send(message);
    expect(sendMail).toHaveBeenCalledTimes(3);
  });

  it('does not retry permanent failures', async () => {
    const sendMail = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('no such user'), { responseCode: 550 }));
    const mailer = createMailer(devConfig, { transport: { sendMail }, retryDelaysMs: [0, 0] });

    await expect(mailer.send(message)).rejects.toThrow('no such user');
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('background sends log failures instead of throwing', async () => {
    const logger = fakeLogger();
    const sendMail = vi.fn().mockRejectedValue(new Error('down'));
    const mailer = createMailer(devConfig, { transport: { sendMail }, logger, retryDelaysMs: [] });

    mailer.sendInBackground(message);
    await mailer.idle();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('down'));
  });

  it('escapes user input in the HTML template', () => {
    const { html, text } = verifyEmailTemplate({
      name: '<script>alert(1)</script>',
      link: 'http://localhost:5173/verify-email?token=abc',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(text).toContain('http://localhost:5173/verify-email?token=abc');
  });
});
