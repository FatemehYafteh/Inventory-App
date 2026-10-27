import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { languageOf, translate } from '../../src/i18n/index.js';
import { en } from '../../src/i18n/en.js';
import { fa } from '../../src/i18n/fa.js';
import {
  START_REPLIES,
  startReply,
  replyLanguage,
} from '../../src/services/telegramAuth.service.js';
import {
  accountApprovedTemplate,
  accountLinkTemplate,
  accountRejectedTemplate,
  passwordChangedTemplate,
  resetPasswordTemplate,
  telegramConflictTemplate,
  verifyEmailTemplate,
} from '../../src/services/mail.templates.js';
import { ORIGIN, buildApp, createUser, useTestDatabase } from '../helpers/setup.js';
import { botConfig, fakeBot } from '../helpers/telegram.js';

useTestDatabase();

const PERSIAN = /[؀-ۿ]/;
const LINK = 'http://localhost:5173/verify-email?token=abc';

function keysOf(node, prefix = '') {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'object' ? keysOf(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe('translate', () => {
  it('interpolates {{name}} placeholders and reads nested keys', () => {
    expect(translate('en', 'mail.greeting', { name: 'Nina' })).toBe('Hi Nina,');
    expect(translate('fa', 'mail.greeting', { name: 'Nina' })).toBe('سلام Nina،');
  });

  it('leaves a placeholder without a value as it is', () => {
    expect(translate('en', 'mail.greeting')).toBe('Hi {{name}},');
  });

  it('falls back to English for an unknown language', () => {
    expect(translate('de', 'mail.greetingNoName')).toBe('Hi,');
    expect(translate(undefined, 'mail.greetingNoName')).toBe('Hi,');
  });

  it('returns the key when no language has it, and never a nested object', () => {
    expect(translate('fa', 'mail.nope')).toBe('mail.nope');
    expect(translate('fa', 'mail')).toBe('mail');
  });

  it('has the same keys in English and Persian', () => {
    expect(keysOf(fa).sort()).toEqual(keysOf(en).sort());
  });

  it('languageOf accepts a language or a user, and defaults to en', () => {
    expect(languageOf('fa')).toBe('fa');
    expect(languageOf({ language: 'fa' })).toBe('fa');
    expect(languageOf({ language: 'fr' })).toBe('en');
    expect(languageOf(null)).toBe('en');
    expect(languageOf('FA')).toBe('en');
  });
});

describe('mail templates in Persian', () => {
  const templates = {
    verify: verifyEmailTemplate({ name: 'Nina', link: LINK }, 'fa'),
    reset: resetPasswordTemplate({ name: 'Nina', link: LINK, hasPassword: true }, 'fa'),
    set: resetPasswordTemplate({ name: 'Nina', link: LINK, hasPassword: false }, 'fa'),
    changed: passwordChangedTemplate({ name: 'Nina', forgotLink: LINK }, 'fa'),
    first: passwordChangedTemplate({ name: 'Nina', forgotLink: LINK, firstPassword: true }, 'fa'),
    link: accountLinkTemplate(
      { name: 'Nina', telegram: { name: 'Ola', username: 'ola_x' }, link: LINK },
      'fa',
    ),
    conflict: telegramConflictTemplate({ name: 'Nina', telegram: { name: 'Ola' } }, 'fa'),
    approved: accountApprovedTemplate({ name: 'Nina', loginLink: LINK }, 'fa'),
    rejected: accountRejectedTemplate({ name: 'Nina', reason: 'Spam' }, 'fa'),
  };

  for (const [name, mail] of Object.entries(templates)) {
    it(`${name}: Persian subject and text, right-to-left html`, () => {
      expect(mail.subject).toMatch(PERSIAN);
      expect(mail.text).toMatch(PERSIAN);
      expect(mail.html).toContain('<html dir="rtl"');
      expect(mail.html).toContain('<body dir="rtl"');
      expect(mail.html).toContain('text-align:right');
      expect(mail.html).toContain('Tahoma');
    });
  }

  it('keeps links intact and in left-to-right text', () => {
    expect(templates.verify.text).toContain(LINK);
    expect(templates.verify.html).toContain(`href="${LINK}"`);
    expect(templates.verify.html).toContain('<bdi dir="ltr"');
  });

  it('says first-password variants differently from reset variants', () => {
    expect(templates.set.subject).not.toBe(templates.reset.subject);
    expect(templates.first.subject).not.toBe(templates.changed.subject);
  });

  it('still escapes user input and shows the rejection reason', () => {
    const mail = accountRejectedTemplate({ name: '<b>x</b>', reason: 'a & b' }, 'fa');
    expect(mail.html).not.toContain('<b>');
    expect(mail.html).toContain('a &amp; b');
    expect(mail.text).toContain('a & b');
  });

  it('falls back to English for an unknown language', () => {
    expect(verifyEmailTemplate({ name: 'Nina', link: LINK }, 'xx')).toEqual(
      verifyEmailTemplate({ name: 'Nina', link: LINK }),
    );
  });
});

describe('mail templates in English', () => {
  it('keeps the exact English verification email', () => {
    expect(verifyEmailTemplate({ name: 'Nina', link: LINK })).toEqual({
      subject: 'Verify your email address',
      text: `Hi Nina,\n\nConfirm your email address to finish creating your Inventory account:\n${LINK}\n\nThis link expires in 24 hours and can be used once. If you did not sign up, ignore this email.`,
      html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:560px;margin:0 auto;padding:24px"><p>Hi Nina,</p><p>Confirm your email address to finish creating your Inventory account.</p><p><a href="${LINK}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Verify email</a></p><p style="font-size:13px;color:#555">Or paste this link into your browser:<br>${LINK}</p><p>This link expires in 24 hours and can be used once. If you did not sign up, ignore this email.</p><p style="color:#666;font-size:12px;margin-top:32px">Inventory Manager</p></body></html>`,
    });
  });
});

function api(app, method, path, body) {
  const start = request(app)[method](path);
  return start.set('Origin', ORIGIN).set('X-Requested-With', 'XMLHttpRequest').send(body);
}

describe('emails follow the recipient language', () => {
  it('sends the verification email in the language chosen at registration', async () => {
    const app = buildApp();
    const password = 'violet-harbor-lantern';

    await api(app, 'post', '/api/auth/register', {
      name: 'Nora New',
      email: 'nora@example.com',
      password,
      confirmPassword: password,
      language: 'fa',
    });
    await app.locals.mailer.idle();

    const [mail] = app.locals.mailer.outbox;
    expect(mail.subject).toBe('تأیید نشانی ایمیل شما');
    expect(mail.html).toContain('dir="rtl"');
  });

  it('sends the password reset email in the user language', async () => {
    const app = buildApp();
    await createUser({ email: 'sara@example.com', language: 'fa' });

    await api(app, 'post', '/api/auth/forgot-password', { email: 'sara@example.com' });
    await app.locals.mailer.idle();

    expect(app.locals.mailer.outbox[0].subject).toBe('بازنشانی رمز عبور');
  });

  it('sends the account link and conflict emails in the owner language, not the requester', async () => {
    const app = buildApp();
    await createUser({
      name: 'Olga Owner',
      email: 'olga@example.com',
      status: 'active',
      language: 'fa',
    });
    const placeholder = await createUser({
      name: 'Nina Novak',
      email: undefined,
      emailVerified: false,
      password: null,
      telegramId: '555000111',
      status: 'pending',
      language: 'en',
    });

    await api(app, 'post', '/api/auth/profile/complete', {
      name: 'Nina Novak',
      email: 'olga@example.com',
    }).set('x-test-user', placeholder.id);
    await app.locals.mailer.idle();

    expect(app.locals.mailer.outbox[0].to).toBe('olga@example.com');
    expect(app.locals.mailer.outbox[0].subject).toMatch(PERSIAN);

    const app2 = buildApp();
    await createUser({
      name: 'Pia Owner',
      email: 'pia@example.com',
      status: 'active',
      telegramId: '999',
      language: 'fa',
    });
    const other = await createUser({
      name: 'Nina Two',
      email: undefined,
      emailVerified: false,
      password: null,
      telegramId: '555000222',
      status: 'pending',
    });
    await api(app2, 'post', '/api/auth/profile/complete', {
      name: 'Nina Two',
      email: 'pia@example.com',
    }).set('x-test-user', other.id);
    await app2.locals.mailer.idle();

    expect(app2.locals.mailer.outbox[0].subject).toBe('کسی تلاش کرد از ایمیل شما استفاده کند');
  });
});

describe('approval and rejection notices follow the user language', () => {
  function setStatus(app, actor, user, status, reason) {
    return api(app, 'patch', `/api/users/${user.id}/status`, { status, reason }).set(
      'x-test-user',
      actor.id,
    );
  }

  it('approves in Persian by email and bot', async () => {
    const app = buildApp();
    const actor = await createUser({ role: 'admin', status: 'active' });
    const user = await createUser({
      status: 'pending',
      email: 'pat@example.com',
      telegramId: '4242',
      language: 'fa',
    });

    await setStatus(app, actor, user, 'active');
    await app.locals.mailer.idle();

    expect(app.locals.mailer.outbox[0].subject).toBe('حساب کاربری Inventory شما تأیید شد');
    expect(app.locals.telegram.outbox[0].text).toBe(
      'حساب کاربری Inventory شما تأیید شد. اکنون می‌توانید از طریق http://localhost:5173 وارد شوید.',
    );
  });

  it('rejects in Persian by email and bot, with the reason only in the email', async () => {
    const app = buildApp();
    const actor = await createUser({ role: 'admin', status: 'active' });
    const user = await createUser({
      status: 'pending',
      email: 'pat@example.com',
      telegramId: '4242',
      language: 'fa',
    });

    await setStatus(app, actor, user, 'rejected', 'Signed up by mistake');
    await app.locals.mailer.idle();

    const [mail] = app.locals.mailer.outbox;
    expect(mail.subject).toBe('درخواست حساب کاربری Inventory شما پذیرفته نشد');
    expect(mail.text).toContain('Signed up by mistake');
    expect(app.locals.telegram.outbox[0].text).toMatch(PERSIAN);
    expect(app.locals.telegram.outbox[0].text).not.toContain('Signed up by mistake');
  });
});

describe('Telegram bot language', () => {
  const NINA = { id: 555000111, is_bot: false, first_name: 'Nina' };
  let updateId = 1000;

  async function say(bot, calls, text, from) {
    updateId += 1;
    const command = text.match(/^\/\w+/);
    await bot.handleUpdate({
      update_id: updateId,
      message: {
        message_id: updateId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: from.id, type: 'private', first_name: from.first_name },
        from,
        text,
        ...(command && {
          entities: [{ type: 'bot_command', offset: 0, length: command[0].length }],
        }),
      },
    });
    return calls.at(-1).payload.text;
  }

  it('keeps START_REPLIES in English and translates by startReply', () => {
    expect(START_REPLIES.help).toBe(
      'To sign in, open the sign-in page and press Continue with Telegram.',
    );
    expect(startReply('help', 'en')).toBe(START_REPLIES.help);
    expect(startReply('locked', 'fa')).toMatch(PERSIAN);
    expect(startReply('locked', 'zz')).toBe(START_REPLIES.locked);
  });

  it('uses the linked user language first, then Telegram language_code, then English', async () => {
    await createUser({ telegramId: '777', language: 'fa' });
    await createUser({ telegramId: '778', language: 'en' });

    expect(await replyLanguage(777, 'en')).toBe('fa');
    expect(await replyLanguage(778, 'fa')).toBe('en');
    expect(await replyLanguage(900, 'fa-IR')).toBe('fa');
    expect(await replyLanguage(900, 'de')).toBe('en');
    expect(await replyLanguage(900, undefined)).toBe('en');
  });

  it('answers the help text and any other message by that rule', async () => {
    const { bot, calls } = fakeBot(botConfig());

    expect(await say(bot, calls, '/start', { ...NINA, language_code: 'fa' })).toBe(
      startReply('help', 'fa'),
    );
    expect(await say(bot, calls, 'hello', { ...NINA, language_code: 'fa' })).toBe(
      startReply('help', 'fa'),
    );
    expect(await say(bot, calls, 'hello', { ...NINA, language_code: 'de' })).toBe(
      START_REPLIES.help,
    );

    await createUser({ telegramId: String(NINA.id), language: 'en' });
    expect(await say(bot, calls, 'hello', { ...NINA, language_code: 'fa' })).toBe(
      START_REPLIES.help,
    );
  });

  it('sends the sign-in code in Persian with Latin digits for a Persian Telegram user', async () => {
    const { bot, calls } = fakeBot(botConfig());
    const res = await api(buildApp(), 'post', '/api/auth/telegram/start');
    const token = new URL(res.body.deepLink).searchParams.get('start');

    const text = await say(bot, calls, `/start ${token}`, { ...NINA, language_code: 'fa' });

    expect(text).toMatch(/^کد ورود شما \d{6} است\. این کد ۲ دقیقه اعتبار دارد\./);
    expect(text).toContain('http://localhost:5173');
  });

  it('answers a linked English user in English even when Telegram is set to Persian', async () => {
    await createUser({ telegramId: String(NINA.id), language: 'en' });
    const { bot, calls } = fakeBot(botConfig());
    const res = await api(buildApp(), 'post', '/api/auth/telegram/start');
    const token = new URL(res.body.deepLink).searchParams.get('start');

    const text = await say(bot, calls, `/start ${token}`, { ...NINA, language_code: 'fa' });

    expect(text).toMatch(/^Your sign-in code is \d{6}\./);
  });
});
