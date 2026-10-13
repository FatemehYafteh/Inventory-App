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
