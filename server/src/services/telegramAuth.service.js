import { randomInt, timingSafeEqual } from 'node:crypto';
import { AuthRequest } from '../models/AuthRequest.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { hashToken, randomToken } from '../utils/crypto.js';
import { startSession } from './auth.service.js';

export const REQUEST_TTL_MS = 10 * 60 * 1000;
export const OTP_TTL_MS = 2 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 3;
export const RESEND_AFTER_MS = 60 * 1000;
// Code sends (first + resends) per Telegram ID.
export const MAX_SENDS_PER_WINDOW = 5;
export const SEND_WINDOW_MS = 60 * 60 * 1000;

export const START_REPLIES = {
  expired: 'This sign-in link has expired. Go back to the sign-in page and start again.',
  help: 'To sign in, open the sign-in page and press Continue with Telegram.',
  refused: 'Access denied, contact an admin.',
  rate_limited: 'Too many codes requested. Try again in an hour.',
};

function codeMessage(code, config) {
  return (
    `Your sign-in code is ${code}. It expires in 2 minutes. ` +
    `Only enter it on ${config.appUrl}. Never share it with anyone.`
  );
}

function invalidCode() {
  return new AppError(400, 'INVALID_CODE', 'This code is invalid or has expired.');
}

function wrongCode(left) {
  return new AppError(
    400,
    'INVALID_CODE',
    `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.`,
  );
}

function tooManyWrongCodes() {
  return new AppError(400, 'TOO_MANY_ATTEMPTS', 'Too many wrong codes.');
}

/** Display name from Telegram: first + last name, at most 100 characters. */
function telegramName(firstName, lastName) {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim().slice(0, 100).trim();
  return name || undefined;
}

/**
 * Whether this Telegram ID may get another code: null, or the status the request takes
 * instead of sending one (`refused` or `rate_limited`). Sends are counted over the requests of the last hour (the TTL
 * index removes older ones, but runs only once a minute).
 */
async function sendRefusal(telegramId, now) {
  // A rejected User never gets a code, so they never see a code form.
  if (await User.exists({ telegramId, status: 'rejected' })) return 'refused';

  const [sent] = await AuthRequest.aggregate([
    { $match: { telegramId, createdAt: { $gt: new Date(now.getTime() - SEND_WINDOW_MS) } } },
    { $group: { _id: null, total: { $sum: '$sendCount' } } },
  ]);
  if ((sent?.total ?? 0) >= MAX_SENDS_PER_WINDOW) return 'rate_limited';
  return null;
}

/** Six digits from a crypto-secure RNG. */
function newCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashOtp(startTokenHash, code, config) {
  // Salted with the request so the same code on two requests never hashes alike.
  return hashToken(`${startTokenHash}:${code}`, config.jwt.refreshSecret);
}

function sameHash(a, b) {
  const left = Buffer.from(a ?? '', 'hex');
  const right = Buffer.from(b ?? '', 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/** Continue with Telegram: creates the request and the deep link the browser opens. */
export async function startLogin({ ip, userAgent }, config, { logger = console } = {}) {
  const bot = config.telegram.botUsername;
  // Never guess a bot: a made-up username could belong to someone else and receive the token.
  if (!bot) {
    throw new AppError(503, 'TELEGRAM_UNAVAILABLE', 'Telegram sign-in is not available right now.');
  }

  const startToken = randomToken(32);
  const request = await AuthRequest.create({
    requestId: randomToken(24),
    purpose: 'login',
    startTokenHash: hashToken(startToken, config.jwt.refreshSecret),
    ip,
    userAgent,
    expiresAt: new Date(Date.now() + REQUEST_TTL_MS),
  });
  if (!config.telegram.botToken && config.nodeEnv === 'development') {
    // No bot in development: show how to press Start by hand.
    logger.info(
      `[telegram] Start token: ${startToken}\n` +
        `[telegram] Press Start with: npm run tg:start -w server -- ${startToken} <telegramId> "<name>" [username]`,
    );
  }
  return {
    requestId: request.requestId,
    deepLink: `https://t.me/${bot}?start=${encodeURIComponent(startToken)}`,
  };
}

/**
 * Pressing Start in Telegram. Claims the pending request for this Telegram account and
 * returns the reply the bot sends to the chat (the code, or a short help text).
 * The bot and the tg:start development script both call this.
 */
export async function handleStart(
  { startToken, telegramId, firstName, lastName, username },
  config,
) {
  if (!startToken) return START_REPLIES.help;

  const startTokenHash = hashToken(startToken, config.jwt.refreshSecret);
  const now = new Date();
  const pending = { startTokenHash, status: 'pending', expiresAt: { $gt: now } };
  if (!(await AuthRequest.exists(pending))) return START_REPLIES.expired;

  const identity = {
    telegramId: String(telegramId),
    telegramUsername: username || undefined,
    name: telegramName(firstName, lastName),
  };
  const refusal = await sendRefusal(identity.telegramId, now);
  if (refusal) {
    const claimed = await AuthRequest.findOneAndUpdate(pending, {
      $set: { ...identity, status: refusal },
    });
    return claimed ? START_REPLIES[refusal] : START_REPLIES.expired;
  }

  const { code, update } = codeSend(startTokenHash, now, config);
  update.$set = { ...update.$set, ...identity, status: 'otp_sent' };
  // Atomic claim: only the first /start for a pending, unexpired request wins.
  const claimed = await AuthRequest.findOneAndUpdate(pending, update);
  return claimed ? codeMessage(code, config) : START_REPLIES.expired;
}

/** A new code for a request, and the update that stores it (old code out, tries reset). */
function codeSend(startTokenHash, now, config) {
  const code = newCode();
  return {
    code,
    update: {
      $set: {
        otpHash: hashOtp(startTokenHash, code, config),
        otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
        attempts: 0,
        lastSentAt: now,
      },
      $inc: { sendCount: 1 },
    },
  };
}

/**
 * Sends a new code 60 s after the last send (also after 3 wrong tries). The old code stops
 * working and the tries start over; the 10-minute request is not extended.
 */
export async function resendCode({ requestId }, config, { messenger }) {
  const now = new Date();
  const request = await AuthRequest.findOne({
    requestId,
    status: 'otp_sent',
    expiresAt: { $gt: now },
  });
  if (!request) {
    throw new AppError(400, 'REQUEST_EXPIRED', 'This sign-in link has expired. Start again.');
  }
  if (now - request.lastSentAt < RESEND_AFTER_MS) throw resendTooSoon();

  const refusal = await sendRefusal(request.telegramId, now);
  if (refusal) {
    await AuthRequest.updateOne(
      { _id: request._id, status: 'otp_sent' },
      { $set: { status: refusal }, $unset: { otpHash: 1 } },
    );
    return getStatus(requestId);
  }

  const { code, update } = codeSend(request.startTokenHash, now, config);
  // Conditional on the last send, so two resends at once send only one code.
  const updated = await AuthRequest.findOneAndUpdate(
    { _id: request._id, status: 'otp_sent', lastSentAt: request.lastSentAt },
    update,
    { new: true },
  );
  if (!updated) throw resendTooSoon();

  await messenger.send(updated.telegramId, codeMessage(code, config));
  return statusOf(updated, now);
}

function resendTooSoon() {
  return new AppError(429, 'RESEND_TOO_SOON', 'Please wait before asking for a new code.');
}

/** What the sign-in page polls. An unknown or timed-out request reads as expired. */
export async function getStatus(requestId) {
  const request = await AuthRequest.findOne({ requestId });
  if (!request) return { status: 'expired' };

  return statusOf(request, new Date());
}

/** Whole seconds from now until `date`, never negative. */
function secondsUntil(date, now) {
  return Math.max(0, Math.ceil((date - now) / 1000));
}

/**
 * The request as the sign-in page sees it. Countdowns are in seconds from now, so the
 * browser's clock does not matter.
 */
function statusOf(request, now) {
  const open = request.status === 'pending' || request.status === 'otp_sent';
  const status = open && request.expiresAt <= now ? 'expired' : request.status;
  const result = {
    status,
    telegramUsername: request.telegramUsername ?? null,
    name: request.name ?? null,
    expiresAt: request.expiresAt,
  };
  if (status === 'otp_sent') {
    result.codeSentAt = request.lastSentAt;
    result.codeExpiresIn = secondsUntil(request.otpExpiresAt, now);
    result.resendIn = secondsUntil(request.lastSentAt.getTime() + RESEND_AFTER_MS, now);
    result.attemptsLeft = Math.max(0, MAX_OTP_ATTEMPTS - request.attempts);
  }
  return result;
}

/**
 * Signs in the User holding this Telegram ID, or creates a Placeholder user for a new one.
 * A rejected User is refused before anything about them changes.
 */
async function signInTelegramUser({ telegramId, telegramUsername, name }, now) {
  const existing = await User.findOne({ telegramId });
  if (!existing) {
    try {
      return await User.create({
        telegramId,
        telegramUsername,
        name,
        role: 'staff',
        status: 'pending',
        lastLoginAt: now,
      });
    } catch (err) {
      // Two verifies for the same new Telegram ID at once: the other one created the user.
      if (err?.code !== 11000) throw err;
      return signInTelegramUser({ telegramId, telegramUsername, name }, now);
    }
  }

  if (existing.status === 'rejected') {
    throw new AppError(403, 'ACCOUNT_REJECTED', 'Access denied');
  }
  // Follow the current Telegram username, including its removal; never touch the name.
  existing.telegramUsername = telegramUsername || undefined;
  existing.lastLoginAt = now;
  await existing.save();
  return existing;
}

/** Checks the code and signs the person in, creating a Placeholder user when needed. */
export async function verifyLogin({ requestId, otp }, meta, config) {
  const now = new Date();
  const live = {
    requestId,
    purpose: 'login',
    status: 'otp_sent',
    expiresAt: { $gt: now },
    otpExpiresAt: { $gt: now },
  };
  // Take a try before comparing, so parallel guesses can never get more than 3 tries.
  const request = await AuthRequest.findOneAndUpdate(
    { ...live, attempts: { $lt: MAX_OTP_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { new: true },
  );
  if (!request) {
    throw (await AuthRequest.exists(live)) ? tooManyWrongCodes() : invalidCode();
  }

  if (!sameHash(hashOtp(request.startTokenHash, otp, config), request.otpHash)) {
    const left = MAX_OTP_ATTEMPTS - request.attempts;
    throw left > 0 ? wrongCode(left) : tooManyWrongCodes();
  }

  // Single use: only one verify can move the request from otp_sent to verified.
  const used = await AuthRequest.findOneAndUpdate(
    { _id: request._id, status: 'otp_sent', otpHash: request.otpHash },
    { $set: { status: 'verified' }, $unset: { otpHash: 1 } },
  );
  if (!used) throw invalidCode();

  const user = await signInTelegramUser(request, now);
  return { user, tokens: await startSession(user, meta, config) };
}
