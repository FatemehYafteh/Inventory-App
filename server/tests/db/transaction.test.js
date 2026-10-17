import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { User } from '../../src/models/User.js';
import { useTestDatabase } from '../helpers/setup.js';

useTestDatabase();

describe('replica set transactions', () => {
  it('commits writes made inside a transaction', async () => {
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await User.create([{ name: 'In transaction', email: 'tx@example.com' }], { session });
    });
    await session.endSession();
    expect(await User.countDocuments({ email: 'tx@example.com' })).toBe(1);
  });

  it('rolls back writes when the transaction fails', async () => {
    const session = await mongoose.startSession();
    await expect(
      session.withTransaction(async () => {
        await User.create([{ name: 'Rolled back', email: 'rollback@example.com' }], { session });
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    await session.endSession();
    expect(await User.countDocuments({ email: 'rollback@example.com' })).toBe(0);
  });
});
