import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DATABASE_DEFAULTS, connectDatabase } from '../../src/config/db.js';

afterEach(() => vi.restoreAllMocks());

describe('connectDatabase', () => {
  it('connects with a short server selection timeout and a small pool by default', async () => {
    const connect = vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);

    await connectDatabase('mongodb://db.example.com/inventory');

    expect(connect).toHaveBeenCalledWith('mongodb://db.example.com/inventory', {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });
    expect(DATABASE_DEFAULTS).toEqual({ serverSelectionTimeoutMS: 5000, maxPoolSize: 10 });
  });

  it('lets the config override the defaults', async () => {
    const connect = vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);

    await connectDatabase('mongodb://db.example.com/inventory', { maxPoolSize: 3 });

    expect(connect).toHaveBeenCalledWith('mongodb://db.example.com/inventory', {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 3,
    });
  });
});
