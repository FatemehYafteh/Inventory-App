import { describe, expect, it, vi } from 'vitest';
import { reloadOnStaleChunk } from './chunkReload';

function setup({ stored } = {}) {
  const target = new EventTarget();
  const data = new Map(stored ? [['chunk-reload-at', String(stored)]] : []);
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  const reload = vi.fn();
  let time = 1_000_000;
  const stop = reloadOnStaleChunk({ target, storage, reload, now: () => time });
  const fail = () => {
    const event = new Event('vite:preloadError', { cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  return { fail, reload, stop, advance: (ms) => (time += ms) };
}

describe('reloadOnStaleChunk', () => {
  it('reloads once when a page file fails to load, and cancels the default error', () => {
    const { fail, reload } = setup();
    const event = fail();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not reload again straight away, so a file that is really missing cannot loop', () => {
    const { fail, reload } = setup();
    fail();
    fail();
    fail();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('may reload again a while later (a different deploy)', () => {
    const { fail, reload, advance } = setup();
    fail();
    advance(60_000);
    fail();
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does nothing when storage is blocked (it could not remember, so it could loop)', () => {
    const target = new EventTarget();
    const reload = vi.fn();
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    reloadOnStaleChunk({ target, storage, reload });
    target.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    expect(reload).not.toHaveBeenCalled();
  });

  it('stops listening when asked', () => {
    const { fail, reload, stop } = setup();
    stop();
    fail();
    expect(reload).not.toHaveBeenCalled();
  });
});
