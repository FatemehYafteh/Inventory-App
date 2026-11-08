// The one account the end-to-end stack creates (stack.mjs) and the tests sign in with. It exists
// only in the in-memory database of a test run.
export const ADMIN = {
  name: 'Ada Admin',
  email: 'admin@example.com',
  password: 'e2e-correct-horse-battery',
};
