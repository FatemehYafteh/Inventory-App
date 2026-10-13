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
