import { randomInt, timingSafeEqual } from 'node:crypto';
import { AuthRequest } from '../models/AuthRequest.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { hashToken, randomToken } from '../utils/crypto.js';
import { startSession } from './auth.service.js';

export const REQUEST_TTL_MS = 10 * 60 * 1000;
export const OTP_TTL_MS = 2 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 3;

export const START_REPLIES = {
  expired: 'This sign-in link has expired. Go back to the sign-in page and start again.',
  help: 'To sign in, open the sign-in page and press Continue with Telegram.',
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

/** Display name from Telegram: first + last name, at most 100 characters. */
function telegramName(firstName, lastName) {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim().slice(0, 100).trim();
  return name || undefined;
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

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const startTokenHash = hashToken(startToken, config.jwt.refreshSecret);
  const now = new Date();
  // Atomic claim: only the first /start for a pending, unexpired request wins.
  const claimed = await AuthRequest.findOneAndUpdate(
    {
      startTokenHash,
      status: 'pending',
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: 'otp_sent',
        telegramId: String(telegramId),
        telegramUsername: username || undefined,
        name: telegramName(firstName, lastName),
        otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
        otpHash: hashOtp(startTokenHash, code, config),
        attempts: 0,
        lastSentAt: now,
      },
      $inc: { sendCount: 1 },
    },
    { new: true },
  );
  if (!claimed) return START_REPLIES.expired;
  return codeMessage(code, config);
}

/** What the sign-in page polls. An unknown or timed-out request reads as expired. */
export async function getStatus(requestId) {
  const request = await AuthRequest.findOne({ requestId });
  if (!request) return { status: 'expired' };

  const open = request.status === 'pending' || request.status === 'otp_sent';
  const status = open && request.expiresAt <= new Date() ? 'expired' : request.status;
  return {
    status,
    telegramUsername: request.telegramUsername ?? null,
    name: request.name ?? null,
    expiresAt: request.expiresAt,
  };
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
  const request = await AuthRequest.findOne({
    requestId,
    purpose: 'login',
    status: 'otp_sent',
    expiresAt: { $gt: now },
    otpExpiresAt: { $gt: now },
    attempts: { $lt: MAX_OTP_ATTEMPTS },
  });
  if (!request) throw invalidCode();

  if (!sameHash(hashOtp(request.startTokenHash, otp, config), request.otpHash)) {
    await AuthRequest.updateOne({ _id: request._id }, { $inc: { attempts: 1 } });
    throw invalidCode();
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
