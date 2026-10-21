import cookieParser from 'cookie-parser';
import express from 'express';
import { webhookCallback } from 'grammy';
import helmet from 'helmet';
import { csrf } from './middleware/csrf.js';
import { errorHandler, notFound } from './middleware/error.js';
import { authRoutes } from './routes/auth.routes.js';
import { categoriesRoutes } from './routes/categories.routes.js';
import { movementsRoutes } from './routes/movements.routes.js';
import { productsRoutes } from './routes/products.routes.js';
import { suppliersRoutes } from './routes/suppliers.routes.js';
import { usersRoutes } from './routes/users.routes.js';
import { createMailer } from './services/mail.service.js';
import { createTelegramMessenger } from './services/telegram.service.js';

/**
 * Builds the Express app. No CORS middleware on purpose: the client is served from the same
 * site, so cross-origin requests get no CORS headers and browsers block them.
 */
export function createApp(
  config,
  { mailer = createMailer(config), telegram = createTelegramMessenger(config), bot } = {},
) {
  const app = express();
  app.locals.config = config;
  app.locals.mailer = mailer;
  app.locals.telegram = telegram;

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  if (bot && config.telegram.mode === 'webhook') {
    // Before the CSRF check: Telegram sends no Origin, and proves itself with the secret
    // token header instead (grammY answers 401 when it is missing or wrong).
    api.post(
      '/telegram/webhook',
      webhookCallback(bot, 'express', {
        secretToken: config.telegram.webhookSecret,
        // A slow update still finishes; answering 200 stops Telegram delivering it again.
        onTimeout: 'return',
      }),
    );
  }
  api.use(csrf(config));
  api.get('/health', (_req, res) => res.json({ status: 'ok' }));
  api.use('/auth', authRoutes(config));
  api.use('/users', usersRoutes(config));
  api.use('/categories', categoriesRoutes(config));
  api.use('/suppliers', suppliersRoutes(config));
  api.use('/products', productsRoutes(config));
  api.use('/movements', movementsRoutes(config));

  app.use('/api', api);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
