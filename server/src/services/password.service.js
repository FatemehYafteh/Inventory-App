import argon2 from 'argon2';

const OPTIONS = { type: argon2.argon2id };

let dummyHashPromise;

export function hashPassword(password) {
  return argon2.hash(password, OPTIONS);
}

export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Runs a full hash verification that always fails. Used when there is no account or no
 * password, so unknown emails take as long as wrong passwords.
 */
export async function verifyDummyPassword(password) {
  dummyHashPromise ??= argon2.hash('dummy-password-for-timing', OPTIONS);
  await verifyPassword(await dummyHashPromise, password);
  return false;
}
