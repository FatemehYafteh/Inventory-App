import { translate } from '../i18n/index.js';
import { accountApprovedTemplate, accountRejectedTemplate } from './mail.templates.js';

// What a user is told for the status they were moved to. Pending has no entry: moving a user
// back to the queue is neither good nor bad news. The bot message never carries the reason.
// Email and bot text follow the user's saved language (English when missing or unknown).
const NOTICES = {
  active: {
    email: ({ user, config }) =>
      accountApprovedTemplate(
        { name: user.name, loginLink: `${config.appUrl}/login` },
        user.language,
      ),
    bot: ({ user, config }) =>
      translate(user.language, 'bot.notify.approved', { appUrl: config.appUrl }),
  },
  rejected: {
    email: ({ user, reason }) =>
      accountRejectedTemplate({ name: user.name, reason }, user.language),
    bot: ({ user }) => translate(user.language, 'bot.notify.rejected'),
  },
};

/** Runs one delivery; a failure (thrown or rejected) is logged and never reaches the caller. */
function deliver(logger, userId, channel, send) {
  const failed = (err) =>
    logger.error(`[notify] ${channel} to user ${userId} failed: ${err.message}`);
  try {
    Promise.resolve(send()).catch(failed);
  } catch (err) {
    failed(err);
  }
}

/**
 * Tells a user their account was approved (also on reactivation to active) or rejected: an
 * email to a verified address and a bot message to a Telegram account. Delivery problems are
 * logged and never reach the caller.
 */
export function notifyStatusChange(
  user,
  { to, reason },
  { config, mailer, telegram, logger = console },
) {
  const notice = NOTICES[to];
  if (!notice) return;
  const context = { user, reason, config };

  if (user.email && user.emailVerified) {
    deliver(logger, user.id, 'Email', () =>
      mailer.sendInBackground({ to: user.email, ...notice.email(context) }),
    );
  }
  if (user.telegramId) {
    deliver(logger, user.id, 'Telegram message', () =>
      telegram.send(user.telegramId, notice.bot(context)),
    );
  }
}
