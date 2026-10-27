import process from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';
import { daysToInstants, instantsToDays } from './dateRange';

const originalZone = process.env.TZ;

afterEach(() => {
  if (originalZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalZone;
});

describe('daysToInstants', () => {
  it('turns one chosen day into the start of that day and the start of the next', () => {
    process.env.TZ = 'Asia/Tehran';
    const result = daysToInstants({ from: new Date(2026, 9, 15, 13, 45) });
    // Tehran is UTC+03:30 with no daylight saving.
    expect(result).toEqual({
      from: '2026-10-14T20:30:00.000Z',
      to: '2026-10-15T20:30:00.000Z',
    });
  });

  it('makes the last chosen day inclusive by ending at the start of the day after it', () => {
    process.env.TZ = 'Asia/Tehran';
    const result = daysToInstants({ from: new Date(2026, 9, 14), to: new Date(2026, 9, 16) });
    expect(result).toEqual({
      from: '2026-10-13T20:30:00.000Z',
      to: '2026-10-16T20:30:00.000Z',
    });
  });

  it('crosses a month end and a year end', () => {
    process.env.TZ = 'UTC';
    expect(daysToInstants({ from: new Date(2026, 8, 30), to: new Date(2026, 9, 1) })).toEqual({
      from: '2026-09-30T00:00:00.000Z',
      to: '2026-10-02T00:00:00.000Z',
    });
    expect(daysToInstants({ from: new Date(2026, 11, 31) })).toEqual({
      from: '2026-12-31T00:00:00.000Z',
      to: '2027-01-01T00:00:00.000Z',
    });
  });

  it('lets a daylight-saving change make a day 25 hours long', () => {
    process.env.TZ = 'America/New_York';
    const { from, to } = daysToInstants({ from: new Date(2026, 10, 1) });
    expect((Date.parse(to) - Date.parse(from)) / 3_600_000).toBe(25);
  });

  it('returns no range when nothing is chosen', () => {
    expect(daysToInstants({})).toEqual({ from: undefined, to: undefined });
  });
});

describe('instantsToDays', () => {
  it('gives back the first and the last chosen day', () => {
    process.env.TZ = 'Asia/Tehran';
    const { from, to } = daysToInstants({ from: new Date(2026, 9, 14), to: new Date(2026, 9, 16) });
    const days = instantsToDays({ from, to });
    expect(days.from.getDate()).toBe(14);
    expect(days.to.getDate()).toBe(16);
  });

  it('ignores a missing or invalid start', () => {
    expect(instantsToDays({ from: '', to: '' })).toEqual({ from: undefined, to: undefined });
    expect(instantsToDays({ from: 'nope' })).toEqual({ from: undefined, to: undefined });
  });
});
