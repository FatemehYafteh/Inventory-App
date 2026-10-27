import { z } from 'zod';

const optional = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const csv = optional.transform((value) =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [],
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    MONGODB_URI: z.string().trim().min(1, 'is required'),
    JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'must be at least 32 characters'),
    COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
    CLIENT_ORIGIN: z.string().trim().url('must be a URL'),
    APP_URL: z.string().trim().url('must be a URL'),
    // Reverse proxies in front of the API (0 = none), so req.ip is the client, not the proxy.
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    TELEGRAM_BOT_TOKEN: optional,
    TELEGRAM_BOT_USERNAME: optional,
    // Telegram's rule for secret_token: 1-256 characters of A-Z, a-z, 0-9, _ and -.
    TELEGRAM_WEBHOOK_SECRET: optional.refine(
      (value) => value === undefined || /^[A-Za-z0-9_-]{1,256}$/.test(value),
      'must be 1-256 characters of A-Z, a-z, 0-9, _ and -',
    ),
    BOT_MODE: z.enum(['polling', 'webhook']).default('polling'),
    ADMIN_TELEGRAM_IDS: csv,
    ADMIN_EMAILS: csv,
    SMTP_HOST: optional,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: optional,
    SMTP_PASS: optional,
    EMAIL_FROM: optional,
    // Brevo's HTTPS API, used instead of SMTP where outbound SMTP is blocked (such as Render's free tier).
    BREVO_API_KEY: optional,
    // send: deliver email (production requires a provider). log: write emails and their links
    // to the server log instead, for a demo deployment with no email provider.
    EMAIL_DELIVERY: z.enum(['send', 'log']).default('send'),
  })
  .superRefine((env, ctx) => {
    // Telegram verifies webhook calls with this secret, so a webhook never runs without one.
    if (env.TELEGRAM_BOT_TOKEN && env.BOT_MODE === 'webhook' && !env.TELEGRAM_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['TELEGRAM_WEBHOOK_SECRET'],
        message: 'is required when BOT_MODE=webhook',
      });
    }

    if (env.NODE_ENV !== 'production') return;
    if (env.BOT_MODE !== 'webhook') {
      ctx.addIssue({
        code: 'custom',
        path: ['BOT_MODE'],
        message: 'must be webhook in production',
      });
    }
    // Email goes out through either the Brevo API or SMTP; with the API key, SMTP is not needed.
    let mailKeys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'];
    if (env.BREVO_API_KEY) mailKeys = ['EMAIL_FROM'];
    if (env.EMAIL_DELIVERY === 'log') mailKeys = [];
    for (const key of [
      ...mailKeys,
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_BOT_USERNAME',
      'TELEGRAM_WEBHOOK_SECRET',
    ]) {
      if (!env[key]) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'is required in production' });
      }
    }
  });

/**
 * Validates environment variables and returns the app config.
 * Throws with a readable list of problems so startup fails fast.
 */
export function loadConfig(source = process.env) {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  const env = result.data;
  const isProduction = env.NODE_ENV === 'production';

  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    isProduction,
    isTest: env.NODE_ENV === 'test',
    port: env.PORT,
    mongoUri: env.MONGODB_URI,
    jwt: { accessSecret: env.JWT_ACCESS_SECRET, refreshSecret: env.JWT_REFRESH_SECRET },
    cookieSecure: isProduction || env.COOKIE_SECURE === 'true',
    clientOrigin: new URL(env.CLIENT_ORIGIN).origin,
    appUrl: env.APP_URL.replace(/\/$/, ''),
    trustProxy: env.TRUST_PROXY,
    telegram: {
      botToken: env.TELEGRAM_BOT_TOKEN,
      botUsername: env.TELEGRAM_BOT_USERNAME,
      webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
      mode: env.BOT_MODE,
    },
    admins: { telegramIds: env.ADMIN_TELEGRAM_IDS, emails: env.ADMIN_EMAILS },
    emailDelivery: env.EMAIL_DELIVERY,
    brevo: env.EMAIL_DELIVERY === 'send' && env.BREVO_API_KEY
      ? { apiKey: env.BREVO_API_KEY, from: env.EMAIL_FROM ?? 'Inventory <no-reply@localhost>' }
      : null,
    smtp: env.EMAIL_DELIVERY === 'send' && env.SMTP_HOST
      ? {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
          from: env.EMAIL_FROM,
        }
      : null,
  });
}
