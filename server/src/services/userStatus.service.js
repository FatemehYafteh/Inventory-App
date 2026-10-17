import mongoose from 'mongoose';
import { StatusChange } from '../models/StatusChange.js';
import { User, isProfileComplete } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { revokeAllForUser } from './token.service.js';
import { notifyStatusChange } from './userNotify.service.js';

export const TRANSITIONS = {
  pending: ['active', 'rejected'],
  active: ['rejected'],
  rejected: ['active', 'pending'],
};

const notFound = () => new AppError(404, 'NOT_FOUND', 'User not found.');
const conflict = (code, message) => new AppError(409, code, message);

const invalidTransition = () =>
  conflict('INVALID_TRANSITION', 'This change is not allowed, or someone else already made it.');
const cannotChangeSelf = () =>
  conflict('CANNOT_CHANGE_SELF', 'You cannot reject or demote yourself.');
const lastAdmin = () => conflict('LAST_ADMIN', 'There must always be at least one active admin.');

async function inTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Re-reads the acting admin inside the transaction and writes to them. The write makes two
 * admins who act at the same moment conflict, so they run one after the other and the
 * second sees the first's result (a rejected admin can no longer act, and the last-admin
 * check counts what is really left).
 */
async function lockAdmin(actorId, session) {
  const admin = await User.findOneAndUpdate(
    { _id: actorId, role: 'admin', status: 'active' },
    { $currentDate: { updatedAt: true } },
    { session, new: true },
  );
  if (!admin) throw new AppError(403, 'FORBIDDEN', 'You do not have access to this.');
  return admin;
}

async function loadTarget(userId, session) {
  if (!mongoose.isValidObjectId(userId)) throw notFound();
  const target = await User.findById(userId).session(session);
  if (!target) throw notFound();
  return target;
}

async function assertAnotherActiveAdmin(targetId, session) {
  const others = await User.countDocuments({
    role: 'admin',
    status: 'active',
    _id: { $ne: targetId },
  }).session(session);
  if (others === 0) throw lastAdmin();
}

/**
 * Approve, reject or reactivate a user, in one transaction: the status update (conditional
 * on the status the admin saw, so only one of two simultaneous changes wins), the
 * StatusChange row, and on rejection the end of the user's sessions. Then notifies the user;
 * a failed notification never undoes the change. Returns the updated user.
 */
export async function changeStatus({ actor, userId, to, reason }, deps) {
  const { user, from } = await inTransaction(async (session) => {
    const admin = await lockAdmin(actor._id, session);
    const target = await loadTarget(userId, session);
    const from = target.status;

    if (!TRANSITIONS[from].includes(to)) throw invalidTransition();
    if (to === 'rejected' && target.id === admin.id) throw cannotChangeSelf();
    if (to === 'active' && !isProfileComplete(target)) {
      throw conflict('PROFILE_INCOMPLETE', 'This user has not completed their profile yet.');
    }
    if (to === 'rejected' && target.role === 'admin' && from === 'active') {
      await assertAnotherActiveAdmin(target._id, session);
    }

    const changed = {
      $set: {
        status: to,
        statusChangedBy: admin._id,
        statusChangedAt: new Date(),
        ...(reason && { statusReason: reason }),
      },
      ...(!reason && { $unset: { statusReason: 1 } }),
    };
    const updated = await User.findOneAndUpdate({ _id: target._id, status: from }, changed, {
      session,
      new: true,
    }).select('+passwordHash');
    if (!updated) throw invalidTransition();

    await StatusChange.create(
      [{ user: target._id, from, to, changedBy: admin._id, changedByName: admin.name, reason }],
      { session },
    );
    if (to === 'rejected') await revokeAllForUser(target._id, { session });
    return { user: updated, from };
  });

  notifyStatusChange(user, { from, to, reason }, deps);
  return user;
}

/**
 * Changes an active user's role. Takes effect on their next request (the role is read from
 * the database), so no session ends and no one is notified. Returns the updated user.
 */
export async function changeRole({ actor, userId, role }) {
  return inTransaction(async (session) => {
    const admin = await lockAdmin(actor._id, session);
    const target = await loadTarget(userId, session);

    if (target.status !== 'active') {
      throw conflict('USER_NOT_ACTIVE', 'Only active users can change role.');
    }
    if (target.role === role) throw invalidTransition();
    if (target.id === admin.id) throw cannotChangeSelf();
    if (target.role === 'admin') await assertAnotherActiveAdmin(target._id, session);

    const updated = await User.findOneAndUpdate(
      { _id: target._id, role: target.role, status: 'active' },
      { $set: { role } },
      { session, new: true },
    ).select('+passwordHash');
    if (!updated) throw invalidTransition();
    return updated;
  });
}
