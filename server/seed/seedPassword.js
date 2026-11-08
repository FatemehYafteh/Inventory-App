// Which password the seeded accounts get.
// The default password is written in the README, so it is only allowed for a database on this
// machine. Any other database (Atlas, a server, CI) needs its own SEED_PASSWORD, or anyone who
// reads the repository could sign in as the seeded admin.

export const DEFAULT_SEED_PASSWORD = 'inventory-demo-2026';
export const MIN_SEED_PASSWORD_LENGTH = 12;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/** True when every host in a mongodb:// URI is this machine. mongodb+srv:// is never local. */
export function isLocalDatabase(uri) {
  const match = /^mongodb:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri ?? '');
  if (!match) return false;
  const hosts = match[1].split(',').map((host) => host.replace(/:\d+$/, '').toLowerCase());
  return hosts.length > 0 && hosts.every((host) => LOCAL_HOSTS.has(host));
}

/**
 * The seed password for `mongoUri`, or throws with a message that says what to set.
 * `seedPassword` is the SEED_PASSWORD environment variable (may be empty).
 */
export function resolveSeedPassword({ mongoUri, seedPassword }) {
  const password = seedPassword?.trim() ?? '';
  if (password) {
    if (password === DEFAULT_SEED_PASSWORD) {
      throw new Error('SEED_PASSWORD must not be the default password from the README.');
    }
    if (password.length < MIN_SEED_PASSWORD_LENGTH) {
      throw new Error(`SEED_PASSWORD must be at least ${MIN_SEED_PASSWORD_LENGTH} characters.`);
    }
    return { password, fromEnv: true };
  }
  if (isLocalDatabase(mongoUri)) return { password: DEFAULT_SEED_PASSWORD, fromEnv: false };
  throw new Error(
    'Refusing to seed a database that is not on this machine with the default password. ' +
      'Set SEED_PASSWORD to a long, private password.',
  );
}
