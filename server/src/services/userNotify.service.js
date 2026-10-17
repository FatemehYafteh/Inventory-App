import { accountApprovedTemplate, accountRejectedTemplate } from './mail.templates.js';

// What a user is told for the status they were moved to. Pending has no entry: moving a user
// back to the queue is neither good nor bad news. The bot message never carries the reason.
const NOTICES = {
  active: {
    email: ({ user, config }) =>
      accountApprovedTemplate({ name: user.name, loginLink: `${config.appUrl}/login` }),
    bot: ({ config }) =>
      `Your Inventory account was approved. You can now log in at ${config.appUrl}.`,
  },
  rejected: {
    email: ({ user, reason }) => accountRejectedTemplate({ name: user.name, reason }),
    bot: () =>
      'Your Inventory account was not approved. Contact an admin if you think this is a mistake.',
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
