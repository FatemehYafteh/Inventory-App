# bot

Telegram bot from sub-PRD 03 (4.6), built with grammY in `bot.js`:

- `createBot(config)` handles `/start <token>` in private chats (the reply comes from
  `telegramAuth.service` `handleStart`) and answers any other message with how to sign in.
- `startBot(bot, config)` checks that the token belongs to `TELEGRAM_BOT_USERNAME` (startup fails
  otherwise), then uses long polling when `BOT_MODE=polling`, or registers the webhook
  at `APP_URL/api/telegram/webhook` when `BOT_MODE=webhook`. The webhook route is mounted in
  `app.js` before the CSRF check and is verified with Telegram's secret-token header. Handler
  errors are logged and answered with 200, so Telegram does not deliver an update twice.
- `index.js` starts it only when `TELEGRAM_BOT_TOKEN` is set. Messages that are not replies
  (resent codes) go through `services/telegram.service.js`.

Approval and rejection messages are added here in sub-PRD 04.
