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
    TELEGRAM_BOT_TOKEN: optional,
    TELEGRAM_BOT_USERNAME: optional,
    TELEGRAM_WEBHOOK_SECRET: optional,
    BOT_MODE: z.enum(['polling', 'webhook']).default('polling'),
    ADMIN_TELEGRAM_IDS: csv,
    ADMIN_EMAILS: csv,
    SMTP_HOST: optional,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: optional,
    SMTP_PASS: optional,
    EMAIL_FROM: optional,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM']) {
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
    telegram: {
      botToken: env.TELEGRAM_BOT_TOKEN,
      botUsername: env.TELEGRAM_BOT_USERNAME,
      webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
      mode: env.BOT_MODE,
    },
    admins: { telegramIds: env.ADMIN_TELEGRAM_IDS, emails: env.ADMIN_EMAILS },
    smtp: env.SMTP_HOST
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
