import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { loadConfig } from './config/env.js';

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  await connectDatabase(config.mongoUri);
  const app = createApp(config);
  const server = app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });

  // The Telegram bot starts here once milestone 3 adds it.

  const shutdown = async () => {
    server.close();
    await app.locals.mailer.idle();
    await disconnectDatabase();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
