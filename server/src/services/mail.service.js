import nodemailer from 'nodemailer';
import { createBrevoTransport } from './brevo.transport.js';

const DEFAULT_RETRY_DELAYS_MS = [500, 2000];
const TRANSIENT_CODES = new Set(['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ECONNRESET']);

function isTransient(err) {
  if (TRANSIENT_CODES.has(err?.code)) return true;
  // SMTP 4xx replies are temporary failures; 5xx are permanent.
  return err?.responseCode >= 400 && err?.responseCode < 500;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Provider-agnostic mailer.
 * - BREVO_API_KEY set: sends through Brevo's HTTPS API (for hosts that block SMTP).
 * - SMTP configured: sends through Nodemailer. Both retry transient failures.
 * - No SMTP in development: writes the email (with its links) to the log.
 * - Tests: keeps messages in `outbox`.
 * `sendInBackground` never throws and never delays the HTTP response, so a delivery
 * problem cannot reveal whether an account exists.
 */
export function createMailer(
  config,
  { transport, logger = console, retryDelaysMs = DEFAULT_RETRY_DELAYS_MS } = {},
) {
  const transporter =
    transport ??
    (config.brevo
      ? createBrevoTransport({ apiKey: config.brevo.apiKey })
      : config.smtp &&
        nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.port === 465,
          auth: { user: config.smtp.user, pass: config.smtp.pass },
        }));
  const from = config.brevo?.from ?? config.smtp?.from ?? 'Inventory <no-reply@localhost>';
  const outbox = [];
  const pending = new Set();

  async function send({ to, subject, text, html }) {
    const message = { from, to, subject, text, html };

    if (!transporter) {
      if (config.isTest) outbox.push(message);
      else logger.info(`[mail] To: ${to}\n[mail] Subject: ${subject}\n${text}\n`);
      return;
    }

    for (let attempt = 0; ; attempt += 1) {
      try {
        await transporter.sendMail(message);
        if (config.isTest) outbox.push(message);
        return;
      } catch (err) {
        if (!isTransient(err) || attempt >= retryDelaysMs.length) throw err;
        await sleep(retryDelaysMs[attempt]);
      }
    }
  }

  function sendInBackground(message) {
    const job = send(message)
      .catch((err) => logger.error(`[mail] Delivery to ${message.to} failed: ${err.message}`))
      .finally(() => pending.delete(job));
    pending.add(job);
  }

  /** Resolves when all background sends have finished. Used by tests and shutdown. */
  async function idle() {
    while (pending.size) await Promise.all([...pending]);
  }

  return { send, sendInBackground, idle, outbox };
}
