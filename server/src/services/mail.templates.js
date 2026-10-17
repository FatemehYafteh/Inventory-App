function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(bodyHtml) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">${bodyHtml}<p style="color:#666;font-size:12px;margin-top:32px">Inventory Manager</p></body></html>`;
}

function button(link, label) {
  return `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${escapeHtml(label)}</a></p><p style="font-size:13px;color:#555">Or paste this link into your browser:<br>${escapeHtml(link)}</p>`;
}

export function verifyEmailTemplate({ name, link }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return {
    subject: 'Verify your email address',
    text: `${greeting}\n\nConfirm your email address to finish creating your Inventory account:\n${link}\n\nThis link expires in 24 hours and can be used once. If you did not sign up, ignore this email.`,
    html: layout(
      `<p>${escapeHtml(greeting)}</p><p>Confirm your email address to finish creating your Inventory account.</p>${button(link, 'Verify email')}<p>This link expires in 24 hours and can be used once. If you did not sign up, ignore this email.</p>`,
    ),
  };
}

/** `hasPassword` false means a first password (e.g. a Telegram signup), so it says "set". */
export function resetPasswordTemplate({ name, link, hasPassword }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const verb = hasPassword ? 'reset' : 'set';
  const intro = hasPassword
    ? 'We received a request to reset the password for your Inventory account.'
    : 'We received a request to set a password for your Inventory account. Once set, you can also log in with your email.';
  const footer = `This link expires in 30 minutes and can be used once. If you did not ask to ${verb} your password, ignore this email.`;
  return {
    subject: hasPassword ? 'Reset your password' : 'Set your password',
    text: `${greeting}\n\n${intro}\n${link}\n\n${footer}`,
    html: layout(
      `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(intro)}</p>${button(link, hasPassword ? 'Reset password' : 'Set password')}<p>${escapeHtml(footer)}</p>`,
    ),
  };
}

/** Sent after a reset. `firstPassword` true when the account had no password before. */
export function passwordChangedTemplate({ name, forgotLink, firstPassword }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const what = firstPassword
    ? 'A password was set for your Inventory account. You can now log in with your email.'
    : 'Your Inventory account password was changed and you were logged out on every device.';
  const warning = "If this wasn't you, reset your password now:";
  return {
    subject: firstPassword ? 'Your password was set' : 'Your password was changed',
    text: `${greeting}\n\n${what}\n\n${warning}\n${forgotLink}`,
    html: layout(
      `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(what)}</p><p>${escapeHtml(warning)}</p>${button(forgotLink, 'Reset password')}`,
    ),
  };
}

/** "Nina Novak (@nina_n)", or just the display name when there is no Telegram username. */
function telegramAccount({ name, username }) {
  const display = name || 'A Telegram user';
  return username ? `${display} (@${username})` : display;
}

/** Case 2: the owner of an email + password account confirms an Account link. */
export function accountLinkTemplate({ name, telegram, link }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const who = telegramAccount(telegram);
  return {
    subject: 'Let a Telegram account sign in to your Inventory account?',
    text: `${greeting}\n\nThe Telegram account ${who} wants to sign in to your Inventory account. To allow it, open this link and enter your password:\n${link}\n\nThe link expires in 24 hours and can be used once. If you did not ask for this, ignore this email and nothing will change.`,
    html: layout(
      `<p>${escapeHtml(greeting)}</p><p>The Telegram account <strong>${escapeHtml(who)}</strong> wants to sign in to your Inventory account. To allow it, open this link and enter your password.</p>${button(link, 'Review and confirm')}<p>The link expires in 24 hours and can be used once. If you did not ask for this, ignore this email and nothing will change.</p>`,
    ),
  };
}

/** Case 3: the address already belongs to an account with a different Telegram account. */
export function telegramConflictTemplate({ name, telegram }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const who = telegramAccount(telegram);
  return {
    subject: 'Someone tried to use your email address',
    text: `${greeting}\n\nThe Telegram account ${who} entered your email address while signing up for Inventory. Your account is already connected to a different Telegram account, so nothing was changed.\n\nIf this was you, sign in with the Telegram account already connected, or contact an admin. If it was not you, you can ignore this email.`,
    html: layout(
      `<p>${escapeHtml(greeting)}</p><p>The Telegram account <strong>${escapeHtml(who)}</strong> entered your email address while signing up for Inventory. Your account is already connected to a different Telegram account, so nothing was changed.</p><p>If this was you, sign in with the Telegram account already connected, or contact an admin. If it was not you, you can ignore this email.</p>`,
    ),
  };
}

/** An admin approved the account (or reactivated a rejected one). */
export function accountApprovedTemplate({ name, loginLink }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const what = 'An admin approved your Inventory account. You can now log in and use the app.';
  return {
    subject: 'Your Inventory account was approved',
    text: `${greeting}\n\n${what}\n${loginLink}`,
    html: layout(
      `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(what)}</p>${button(loginLink, 'Log in')}`,
    ),
  };
}

/** An admin rejected the account. The reason is shown only when the admin gave one. */
export function accountRejectedTemplate({ name, reason }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const what = 'An admin did not approve your Inventory account request.';
  const why = reason ? `Reason: ${reason}` : '';
  const help = 'If you think this is a mistake, contact an admin.';
  return {
    subject: 'Your Inventory account request was declined',
    text: [greeting, what, why, help].filter(Boolean).join('\n\n'),
    html: layout(
      `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(what)}</p>${why ? `<p>${escapeHtml(why)}</p>` : ''}<p>${escapeHtml(help)}</p>`,
    ),
  };
}
