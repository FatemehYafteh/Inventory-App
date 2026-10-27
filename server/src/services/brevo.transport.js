const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

/** Splits `Name <address>` (or a bare address) into Brevo's sender object. */
export function parseSender(from) {
  const match = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(from);
  if (!match) return { email: from.trim() };
  const name = match[1]?.trim();
  return name ? { name, email: match[2].trim() } : { email: match[2].trim() };
}

/**
 * A Nodemailer-shaped transport (`sendMail(message)`) that sends through Brevo's HTTPS API.
 * Used where outbound SMTP is blocked, such as Render's free instances. Errors carry the same
 * markers mail.service uses to tell temporary failures from permanent ones: network errors and
 * 429/5xx get a transient `code`, other 4xx answers are permanent.
 */
export function createBrevoTransport({ apiKey, fetch: fetchImpl = globalThis.fetch }) {
  return {
    async sendMail({ from, to, subject, text, html }) {
      let response;
      try {
        response = await fetchImpl(BREVO_URL, {
          method: 'POST',
          headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            sender: parseSender(from),
            to: [{ email: to }],
            subject,
            textContent: text,
            htmlContent: html,
          }),
        });
      } catch (err) {
        throw Object.assign(new Error(`Brevo request failed: ${err.message}`), {
          code: 'ECONNECTION',
        });
      }

      if (response.ok) return response.json().catch(() => ({}));

      const body = await response.text().catch(() => '');
      const transient = response.status === 429 || response.status >= 500;
      throw Object.assign(new Error(`Brevo answered ${response.status}: ${body.slice(0, 200)}`), {
        ...(transient && { code: 'ECONNECTION' }),
        status: response.status,
      });
    },
  };
}
