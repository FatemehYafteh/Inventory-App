// English server-sent text (emails and Telegram bot). Also the fallback for every language.
export const en = {
  mail: {
    greeting: 'Hi {{name}},',
    greetingNoName: 'Hi,',
    pasteLink: 'Or paste this link into your browser:',
    footer: 'Inventory Manager',
    telegramUserFallback: 'A Telegram user',
    verify: {
      subject: 'Verify your email address',
      textIntro: 'Confirm your email address to finish creating your Inventory account:',
      htmlIntro: 'Confirm your email address to finish creating your Inventory account.',
      button: 'Verify email',
      note: 'This link expires in 24 hours and can be used once. If you did not sign up, ignore this email.',
    },
    reset: {
      subject: 'Reset your password',
      intro: 'We received a request to reset the password for your Inventory account.',
      button: 'Reset password',
      note: 'This link expires in 30 minutes and can be used once. If you did not ask to reset your password, ignore this email.',
    },
    setPassword: {
      subject: 'Set your password',
      intro:
        'We received a request to set a password for your Inventory account. Once set, you can also log in with your email.',
      button: 'Set password',
      note: 'This link expires in 30 minutes and can be used once. If you did not ask to set your password, ignore this email.',
    },
    passwordChanged: {
      subject: 'Your password was changed',
      what: 'Your Inventory account password was changed and you were logged out on every device.',
      warning: "If this wasn't you, reset your password now:",
      button: 'Reset password',
    },
    passwordSet: {
      subject: 'Your password was set',
      what: 'A password was set for your Inventory account. You can now log in with your email.',
      warning: "If this wasn't you, reset your password now:",
      button: 'Reset password',
    },
    accountLink: {
      subject: 'Let a Telegram account sign in to your Inventory account?',
      textBody:
        'The Telegram account {{who}} wants to sign in to your Inventory account. To allow it, open this link and enter your password:',
      htmlBody:
        'The Telegram account {{who}} wants to sign in to your Inventory account. To allow it, open this link and enter your password.',
      button: 'Review and confirm',
      note: 'The link expires in 24 hours and can be used once. If you did not ask for this, ignore this email and nothing will change.',
    },
    telegramConflict: {
      subject: 'Someone tried to use your email address',
      body: 'The Telegram account {{who}} entered your email address while signing up for Inventory. Your account is already connected to a different Telegram account, so nothing was changed.',
      note: 'If this was you, sign in with the Telegram account already connected, or contact an admin. If it was not you, you can ignore this email.',
    },
    approved: {
      subject: 'Your Inventory account was approved',
      what: 'An admin approved your Inventory account. You can now log in and use the app.',
      button: 'Log in',
    },
    rejected: {
      subject: 'Your Inventory account request was declined',
      what: 'An admin did not approve your Inventory account request.',
      reason: 'Reason: {{reason}}',
      help: 'If you think this is a mistake, contact an admin.',
    },
  },
  bot: {
    start: {
      expired: 'This sign-in link has expired. Go back to the sign-in page and start again.',
      help: 'To sign in, open the sign-in page and press Continue with Telegram.',
      refused: 'Access denied, contact an admin.',
      rate_limited: 'Too many codes requested. Try again in an hour.',
      locked: 'Too many wrong codes. Try again later.',
    },
    code: {
      connect: 'Your code to connect Telegram to your account is {{code}}.',
      login: 'Your sign-in code is {{code}}.',
      tail: 'It expires in 2 minutes. Only enter it on {{appUrl}}. Never share it with anyone.',
    },
    notify: {
      approved: 'Your Inventory account was approved. You can now log in at {{appUrl}}.',
      rejected:
        'Your Inventory account was not approved. Contact an admin if you think this is a mistake.',
    },
  },
};
