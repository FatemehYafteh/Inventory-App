import { randomInt, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import { AuthRequest } from '../models/AuthRequest.js';
import { User, isPlaceholder } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { hashToken, randomToken } from '../utils/crypto.js';
import { startSession } from './auth.service.js';
import { applyAdminBootstrap } from './adminBootstrap.service.js';
import { deletePlaceholder } from './placeholder.service.js';

export const REQUEST_TTL_MS = 10 * 60 * 1000;
// A sign-in request started again after a wrong code.
export const RETRY_REQUEST_TTL_MS = 5 * 60 * 1000;
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
  locked: 'Too many wrong codes. Try again later.',
};

function codeMessage(code, purpose, config) {
  const intro =
    purpose === 'connect'
      ? `Your code to connect Telegram to your account is ${code}.`
      : `Your sign-in code is ${code}.`;
  return (
    `${intro} It expires in 2 minutes. ` +
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
async function sendRefusal(telegramId, purpose, now) {
  // A rejected User never gets a sign-in code. Connect Telegram checks who owns the ID only
  // after the code is accepted, so its requests never reveal an owner here.
  if (purpose === 'login' && (await User.exists({ telegramId, status: 'rejected' }))) {
    return 'refused';
  }

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

/**
 * The request as `viewer` may see it, or null: anyone holding a sign-in request's id, but
 * only the signed-in `connectUser` for a Connect Telegram request. A connect request with
 * no signed-in viewer is a 401, so a client whose access token expired mid-flow refreshes
 * its session and tries again instead of reading the request as expired.
 */
async function findVisibleRequest(filter, viewer) {
  const request = await AuthRequest.findOne(filter);
  if (!request || request.purpose === 'login') return request;
  if (!viewer) throw new AppError(401, 'NOT_AUTHENTICATED', 'Please log in to continue.');
  return request.connectUser?.equals(viewer._id) ? request : null;
}

/**
 * Continue with Telegram: creates the request and the deep link the browser opens. With
 * `previousRequestId` (the sign-in page starting again after a wrong code), that request stops
 * working and the new one lasts 5 minutes; its tries carry over when Start is pressed.
 */
export async function startLogin({ previousRequestId, ...meta }, config, options) {
  const replaced =
    previousRequestId &&
    (await AuthRequest.findOneAndUpdate(
      {
        requestId: previousRequestId,
        purpose: 'login',
        status: 'otp_sent',
        attempts: { $gt: 0, $lt: MAX_OTP_ATTEMPTS },
        expiresAt: { $gt: new Date() },
      },
      { $set: { status: 'expired' }, $unset: { otpHash: 1 } },
    ));
  const ttlMs = replaced ? RETRY_REQUEST_TTL_MS : REQUEST_TTL_MS;
  return startRequest({ ...meta, purpose: 'login', ttlMs }, config, options);
}

/**
 * Sign-in only: the wrong tries a Telegram ID has used and when they stop counting, or null.
 * Only its latest sign-in request counts, so a verified sign-in starts the tries over.
 */
async function carriedTries(telegramId, now) {
  const last = await AuthRequest.findOne({ telegramId, purpose: 'login' })
    .sort({ createdAt: -1 })
    .select('status attempts triesUntil');
  if (!last || last.status === 'verified' || !last.attempts || !(last.triesUntil > now)) {
    return null;
  }
  return { attempts: last.attempts, triesUntil: last.triesUntil };
}

function telegramAlreadyConnected() {
  return new AppError(409, 'TELEGRAM_ALREADY_CONNECTED', 'Your account already has Telegram.');
}

/** Connect Telegram on the Profile page: the same deep link, for the signed-in user. */
export function startConnect(user, meta, config, options) {
  if (user.telegramId) throw telegramAlreadyConnected();
  return startRequest({ ...meta, purpose: 'connect', connectUser: user._id }, config, options);
}

async function startRequest(
  { purpose, connectUser, ip, userAgent, ttlMs = REQUEST_TTL_MS },
  config,
  { logger = console } = {},
) {
  const bot = config.telegram.botUsername;
  // Never guess a bot: a made-up username could belong to someone else and receive the token.
  if (!bot) {
    throw new AppError(503, 'TELEGRAM_UNAVAILABLE', 'Telegram sign-in is not available right now.');
  }

  const startToken = randomToken(32);
  const request = await AuthRequest.create({
    requestId: randomToken(24),
    purpose,
    connectUser,
    startTokenHash: hashToken(startToken, config.jwt.refreshSecret),
    ip,
    userAgent,
    expiresAt: new Date(Date.now() + ttlMs),
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
  const request = await AuthRequest.findOne(pending).select('purpose expiresAt');
  if (!request) return START_REPLIES.expired;

  const identity = {
    telegramId: String(telegramId),
    telegramUsername: username || undefined,
    name: telegramName(firstName, lastName),
  };
  // Sign-in: wrong tries count across new links until the first one would have expired.
  if (request.purpose === 'login') {
    const carried = await carriedTries(identity.telegramId, now);
    identity.attempts = carried?.attempts ?? 0;
    identity.triesUntil = carried?.triesUntil ?? request.expiresAt;
  }
  let refusal = await sendRefusal(identity.telegramId, request.purpose, now);
  if (!refusal && identity.attempts >= MAX_OTP_ATTEMPTS) refusal = 'locked';
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
  return claimed ? codeMessage(code, request.purpose, config) : START_REPLIES.expired;
}

/** A new code for a request, and the update that stores it (old code out). */
function codeSend(startTokenHash, now, config) {
  const code = newCode();
  return {
    code,
    update: {
      $set: {
        otpHash: hashOtp(startTokenHash, code, config),
        otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
        lastSentAt: now,
      },
      $inc: { sendCount: 1 },
    },
  };
}

/**
 * Sends a new code 60 s after the last send; the old code stops working and the request is
 * not extended. Connect Telegram: also after 3 wrong tries, and the tries start over.
 * Sign-in: the tries carry on, and after 3 wrong tries there is no new code.
 */
export async function resendCode({ requestId }, config, { messenger, viewer }) {
  const now = new Date();
  const request = await findVisibleRequest(
    { requestId, status: 'otp_sent', expiresAt: { $gt: now } },
    viewer,
  );
  if (!request) {
    throw new AppError(400, 'REQUEST_EXPIRED', 'This link has expired. Start again.');
  }
  const login = request.purpose === 'login';
  if (login && request.attempts >= MAX_OTP_ATTEMPTS) throw tooManyWrongCodes();
  if (now - request.lastSentAt < RESEND_AFTER_MS) throw resendTooSoon();

  const refusal = await sendRefusal(request.telegramId, request.purpose, now);
  if (refusal) {
    await AuthRequest.updateOne(
      { _id: request._id, status: 'otp_sent' },
      { $set: { status: refusal }, $unset: { otpHash: 1 } },
    );
    return getStatus(requestId, viewer);
  }

  const { code, update } = codeSend(request.startTokenHash, now, config);
  if (!login) update.$set.attempts = 0;
  // Conditional on the last send (and, for sign-in, the tries), so two resends at once send
  // only one code and a resend never races past a third wrong try.
  const updated = await AuthRequest.findOneAndUpdate(
    {
      _id: request._id,
      status: 'otp_sent',
      lastSentAt: request.lastSentAt,
      ...(login && { attempts: { $lt: MAX_OTP_ATTEMPTS } }),
    },
    update,
    { new: true },
  );
  if (!updated) throw resendTooSoon();

  await messenger.send(updated.telegramId, codeMessage(code, updated.purpose, config));
  return statusOf(updated, now);
}

function resendTooSoon() {
  return new AppError(429, 'RESEND_TOO_SOON', 'Please wait before asking for a new code.');
}

/**
 * What the sign-in page (or Profile, for Connect Telegram) polls. An unknown or timed-out
 * request, or someone else's Connect Telegram request, reads as expired.
 */
export async function getStatus(requestId, viewer) {
  const request = await findVisibleRequest({ requestId }, viewer);
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

/**
 * Accepts the code for a request with a code sent and marks it used, or throws: 3 tries,
 * single use, constant-time comparison. Returns the request.
 */
async function acceptCode({ requestId, otp, purpose, connectUser }, config) {
  const now = new Date();
  const live = {
    requestId,
    purpose,
    ...(connectUser && { connectUser }),
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
  return request;
}

/** Checks the code and signs the person in, creating a Placeholder user when needed. */
export async function verifyLogin({ requestId, otp }, meta, config) {
  const request = await acceptCode({ requestId, otp, purpose: 'login' }, config);
  const user = await signInTelegramUser(request, new Date());
  return { user, tokens: await startSession(user, meta, config) };
}

function telegramOwned() {
  return new AppError(
    409,
    'TELEGRAM_OWNED',
    'This Telegram account belongs to another user. Contact an admin.',
  );
}

/**
 * Connect Telegram: checks the code, then (only now) who holds the Telegram ID. Nobody: it is
 * attached to the user. A Placeholder user: absorbed in one transaction (the ID moves over,
 * the Placeholder user is deleted with its sessions and email tokens). Anyone else: 409.
 * Returns the updated user.
 */
export async function verifyConnect({ requestId, otp }, user, config) {
  const request = await acceptCode(
    { requestId, otp, purpose: 'connect', connectUser: user._id },
    config,
  );
  const { telegramId, telegramUsername } = request;
  const holder = await User.findOne({ telegramId });
  // A rejected account never gains a sign-in method, so a rejected Placeholder is not absorbed.
  if (holder && (!isPlaceholder(holder) || holder.status === 'rejected')) throw telegramOwned();

  const telegram = { telegramId };
  if (telegramUsername) telegram.telegramUsername = telegramUsername;
  const session = await mongoose.startSession();
  let connected;
  try {
    await session.withTransaction(async () => {
      if (holder) {
        const removed = await deletePlaceholder(
          { _id: holder._id, telegramId, emailVerified: false, status: { $ne: 'rejected' } },
          session,
        );
        if (!removed) throw telegramOwned();
      }
      connected = await User.findOneAndUpdate(
        { _id: user._id, telegramId: { $exists: false } },
        { $set: telegram },
        { session, new: true },
      );
      if (!connected) throw telegramAlreadyConnected();
      await applyAdminBootstrap(connected._id, config, { session });
    });
  } catch (err) {
    // Another User took the ID meanwhile.
    if (err?.code === 11000) throw telegramOwned();
    throw err;
  } finally {
    await session.endSession();
  }
  return connected;
}
