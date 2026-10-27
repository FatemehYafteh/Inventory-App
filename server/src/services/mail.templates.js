import { languageOf, translate } from '../i18n/index.js';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FSI = '⁨';
const PDI = '⁩';

/** Keeps a Latin name or handle from scrambling the order of right-to-left text. */
function isolate(language, value) {
  return language === 'fa' ? `${FSI}${value}${PDI}` : value;
}

function layout(language, bodyHtml) {
  const footer = escapeHtml(translate(language, 'mail.footer'));
  if (language === 'fa') {
    const style =
      'font-family:Tahoma,Arial,sans-serif;color:#111;line-height:1.7;max-width:560px;margin:0 auto;padding:24px;direction:rtl;text-align:right';
    return `<!doctype html><html dir="rtl" lang="fa"><body dir="rtl" style="${style}">${bodyHtml}<p dir="ltr" style="color:#666;font-size:12px;margin-top:32px;text-align:right">${footer}</p></body></html>`;
  }
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">${bodyHtml}<p style="color:#666;font-size:12px;margin-top:32px">${footer}</p></body></html>`;
}

function button(language, link, label) {
  const shownLink =
    language === 'fa'
      ? `<bdi dir="ltr" style="direction:ltr;unicode-bidi:isolate">${escapeHtml(link)}</bdi>`
      : escapeHtml(link);
  return `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${escapeHtml(label)}</a></p><p style="font-size:13px;color:#555">${escapeHtml(translate(language, 'mail.pasteLink'))}<br>${shownLink}</p>`;
}

function greetingFor(language, name) {
  return name
    ? translate(language, 'mail.greeting', { name: isolate(language, name) })
    : translate(language, 'mail.greetingNoName');
}

export function verifyEmailTemplate({ name, link }, language = 'en') {
  const lang = languageOf(language);
  const t = (key) => translate(lang, `mail.verify.${key}`);
  const greeting = greetingFor(lang, name);
  return {
    subject: t('subject'),
    text: `${greeting}\n\n${t('textIntro')}\n${link}\n\n${t('note')}`,
    html: layout(
      lang,
      `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(t('htmlIntro'))}</p>${button(lang, link, t('button'))}<p>${escapeHtml(t('note'))}</p>`,
    ),
  };
}

/** `hasPassword` false means a first password (e.g. a Telegram signup), so it says "set". */
export function resetPasswordTemplate({ name, link, hasPassword }, language = 'en') {
  const lang = languageOf(language);
  const t = (key) => translate(lang, `mail.${hasPassword ? 'reset' : 'setPassword'}.${key}`);
  const greeting = greetingFor(lang, name);
  return {
    subject: t('subject'),
    text: `${greeting}\n\n${t('intro')}\n${link}\n\n${t('note')}`,
    html: layout(
      lang,
      `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(t('intro'))}</p>${button(lang, link, t('button'))}<p>${escapeHtml(t('note'))}</p>`,
    ),
  };
}

/** Sent after a reset. `firstPassword` true when the account had no password before. */
export function passwordChangedTemplate({ name, forgotLink, firstPassword }, language = 'en') {
  const lang = languageOf(language);
  const t = (key) =>
    translate(lang, `mail.${firstPassword ? 'passwordSet' : 'passwordChanged'}.${key}`);
  const greeting = greetingFor(lang, name);
  return {
    subject: t('subject'),
    text: `${greeting}\n\n${t('what')}\n\n${t('warning')}\n${forgotLink}`,
    html: layout(
      lang,
      `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(t('what'))}</p><p>${escapeHtml(t('warning'))}</p>${button(lang, forgotLink, t('button'))}`,
    ),
  };
}

/** "Nina Novak (@nina_n)", or just the display name when there is no Telegram username. */
function telegramAccount({ name, username }, language) {
  const display = name || translate(language, 'mail.telegramUserFallback');
  return isolate(language, username ? `${display} (@${username})` : display);
}

/** Case 2: the owner of an email + password account confirms an Account link. */
export function accountLinkTemplate({ name, telegram, link }, language = 'en') {
  const lang = languageOf(language);
  const t = (key, vars) => translate(lang, `mail.accountLink.${key}`, vars);
  const greeting = greetingFor(lang, name);
  const who = telegramAccount(telegram, lang);
  return {
    subject: t('subject'),
    text: `${greeting}\n\n${t('textBody', { who })}\n${link}\n\n${t('note')}`,
    html: layout(
      lang,
      `<p>${escapeHtml(greeting)}</p><p>${t('htmlBody', { who: `<strong>${escapeHtml(who)}</strong>` })}</p>${button(lang, link, t('button'))}<p>${t('note')}</p>`,
    ),
  };
}

/** Case 3: the address already belongs to an account with a different Telegram account. */
export function telegramConflictTemplate({ name, telegram }, language = 'en') {
  const lang = languageOf(language);
  const t = (key, vars) => translate(lang, `mail.telegramConflict.${key}`, vars);
  const greeting = greetingFor(lang, name);
  const who = telegramAccount(telegram, lang);
  return {
    subject: t('subject'),
    text: `${greeting}\n\n${t('body', { who })}\n\n${t('note')}`,
    html: layout(
      lang,
      `<p>${escapeHtml(greeting)}</p><p>${t('body', { who: `<strong>${escapeHtml(who)}</strong>` })}</p><p>${t('note')}</p>`,
    ),
  };
}

/** An admin approved the account (or reactivated a rejected one). */
export function accountApprovedTemplate({ name, loginLink }, language = 'en') {
  const lang = languageOf(language);
  const t = (key) => translate(lang, `mail.approved.${key}`);
  const greeting = greetingFor(lang, name);
  return {
    subject: t('subject'),
    text: `${greeting}\n\n${t('what')}\n${loginLink}`,
    html: layout(
      lang,
      `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(t('what'))}</p>${button(lang, loginLink, t('button'))}`,
    ),
  };
}

/** An admin rejected the account. The reason is shown only when the admin gave one. */
export function accountRejectedTemplate({ name, reason }, language = 'en') {
  const lang = languageOf(language);
  const t = (key, vars) => translate(lang, `mail.rejected.${key}`, vars);
  const greeting = greetingFor(lang, name);
  const why = reason ? t('reason', { reason: isolate(lang, reason) }) : '';
  return {
    subject: t('subject'),
    text: [greeting, t('what'), why, t('help')].filter(Boolean).join('\n\n'),
    html: layout(
      lang,
      `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(t('what'))}</p>${why ? `<p>${escapeHtml(why)}</p>` : ''}<p>${escapeHtml(t('help'))}</p>`,
    ),
  };
}
