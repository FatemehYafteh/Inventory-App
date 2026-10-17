import mongoose from 'mongoose';
import { STATUSES } from './User.js';

/**
 * One move of a User's status: who made it, when, from and to which status, and the reason
 * if given. Written in the same transaction as the status update. `changedBy` is null when
 * the system made the change (the admin bootstrap).
 */
const statusChangeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  from: { type: String, enum: STATUSES, required: true },
  to: { type: String, enum: STATUSES, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // The name at the time, so history survives a rename.
  changedByName: { type: String, required: true },
  reason: { type: String, trim: true, maxlength: 500 },
  at: { type: Date, default: Date.now },
});

statusChangeSchema.index({ user: 1, at: -1 });

export const StatusChange = mongoose.model('StatusChange', statusChangeSchema);
