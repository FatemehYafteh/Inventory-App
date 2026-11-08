import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEED_PASSWORD,
  isLocalDatabase,
  resolveSeedPassword,
} from '../../seed/seedPassword.js';

const ATLAS = 'mongodb+srv://user:pass@cluster0.abcde.mongodb.net/inventory';
const LOCAL = 'mongodb://127.0.0.1:27017/inventory';

describe('isLocalDatabase', () => {
  it('is true only when every host is this machine', () => {
    expect(isLocalDatabase('mongodb://localhost:27017/inventory')).toBe(true);
    expect(isLocalDatabase(LOCAL)).toBe(true);
    expect(isLocalDatabase('mongodb://user:pass@localhost/inventory?authSource=admin')).toBe(true);
    expect(isLocalDatabase('mongodb://localhost:27017,127.0.0.1:27018/inventory')).toBe(true);
  });

  it('is false for Atlas, other hosts, a mix, or no URI', () => {
    expect(isLocalDatabase(ATLAS)).toBe(false);
    expect(isLocalDatabase('mongodb://db.example.com:27017/inventory')).toBe(false);
    expect(isLocalDatabase('mongodb://localhost:27017,db.example.com:27017/inventory')).toBe(false);
    expect(isLocalDatabase('mongodb://localhost.evil.com/inventory')).toBe(false);
    expect(isLocalDatabase(undefined)).toBe(false);
  });
});

describe('resolveSeedPassword', () => {
  it('uses the default password for a local database when SEED_PASSWORD is unset', () => {
    expect(resolveSeedPassword({ mongoUri: LOCAL, seedPassword: undefined })).toEqual({
      password: DEFAULT_SEED_PASSWORD,
      fromEnv: false,
    });
    expect(resolveSeedPassword({ mongoUri: LOCAL, seedPassword: '  ' }).fromEnv).toBe(false);
  });

  it('refuses a remote database without SEED_PASSWORD', () => {
    expect(() => resolveSeedPassword({ mongoUri: ATLAS, seedPassword: '' })).toThrow(
      /Set SEED_PASSWORD/,
    );
  });

  it('uses SEED_PASSWORD when it is long enough, for any database', () => {
    const seedPassword = 'a-long-private-password';
    expect(resolveSeedPassword({ mongoUri: ATLAS, seedPassword })).toEqual({
      password: seedPassword,
      fromEnv: true,
    });
  });

  it('refuses a short SEED_PASSWORD or the default one from the README', () => {
    expect(() => resolveSeedPassword({ mongoUri: ATLAS, seedPassword: 'short' })).toThrow(
      /at least 12/,
    );
    expect(() =>
      resolveSeedPassword({ mongoUri: ATLAS, seedPassword: DEFAULT_SEED_PASSWORD }),
    ).toThrow(/default password/);
  });
});
