import { accountApprovedTemplate, accountRejectedTemplate } from './mail.templates.js';

function kindOf(to) {
  if (to === 'active') return 'approved';
  if (to === 'rejected') return 'rejected';
  return null; // Moving a user back to pending is neither good nor bad news.
}

function botMessage(kind, config) {
  return kind === 'approved'
    ? `Your Inventory account was approved. You can now log in at ${config.appUrl}.`
    : 'Your Inventory account was not approved. Contact an admin if you think this is a mistake.';
}

/**
 * Tells a user their account was approved (also on reactivation to active) or rejected: an
 * email to a verified address and a bot message to a Telegram account. The bot message never
 * carries the reason. Delivery problems are logged and never reach the caller.
 */
export function notifyStatusChange(
  user,
  { to, reason },
  { config, mailer, telegram, logger = console },
) {
  const kind = kindOf(to);
  if (!kind) return;

  try {
    if (user.email && user.emailVerified) {
      const template =
        kind === 'approved'
          ? accountApprovedTemplate({ name: user.name, loginLink: `${config.appUrl}/login` })
          : accountRejectedTemplate({ name: user.name, reason });
      mailer.sendInBackground({ to: user.email, ...template });
    }
  } catch (err) {
    logger.error(`[notify] Email to user ${user.id} failed: ${err.message}`);
  }

  try {
    if (user.telegramId) {
      Promise.resolve(telegram.send(user.telegramId, botMessage(kind, config))).catch((err) =>
        logger.error(`[notify] Telegram message to user ${user.id} failed: ${err.message}`),
      );
    }
  } catch (err) {
    logger.error(`[notify] Telegram message to user ${user.id} failed: ${err.message}`);
  }
}
