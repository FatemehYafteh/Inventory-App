import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitUntil } from '../../src/utils/waitUntil.js';

const REQUEST_CONTEXT = Symbol.for('@vercel/request-context');

afterEach(() => {
  delete globalThis[REQUEST_CONTEXT];
});

describe('waitUntil', () => {
  it('hands the promise to the Vercel request context when there is one', () => {
    const hook = vi.fn();
    globalThis[REQUEST_CONTEXT] = { get: () => ({ waitUntil: hook }) };
    const job = Promise.resolve('done');

    expect(waitUntil(job)).toBe(job);
    expect(hook).toHaveBeenCalledWith(job);
  });

  it('returns the promise unchanged outside Vercel', async () => {
    const job = Promise.resolve('done');

    expect(waitUntil(job)).toBe(job);
    await expect(job).resolves.toBe('done');
  });

  it('ignores a broken request context', () => {
    globalThis[REQUEST_CONTEXT] = {
      get: () => {
        throw new Error('no context');
      },
    };
    const job = Promise.resolve();

    expect(waitUntil(job)).toBe(job);
  });
});
