import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { csrf } from './middleware/csrf.js';
import { errorHandler, notFound } from './middleware/error.js';
import { authRoutes } from './routes/auth.routes.js';
import { createMailer } from './services/mail.service.js';

/**
 * Builds the Express app. No CORS middleware on purpose: the client is served from the same
 * site, so cross-origin requests get no CORS headers and browsers block them.
 */
export function createApp(config, { mailer = createMailer(config) } = {}) {
  const app = express();
  app.locals.config = config;
  app.locals.mailer = mailer;

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(csrf(config));
  api.get('/health', (_req, res) => res.json({ status: 'ok' }));
  api.use('/auth', authRoutes(config));

  app.use('/api', api);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
