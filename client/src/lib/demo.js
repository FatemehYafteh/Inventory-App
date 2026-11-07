/**
 * True when the signed-in user is the demo account shown on the login page (VITE_DEMO_EMAIL).
 * Only a hint for the UI: the server refuses the demo account's changes on its own
 * (DEMO_EMAILS), so set both to the same email.
 */
export function isDemoUser(user, demoEmail = import.meta.env.VITE_DEMO_EMAIL) {
  const demo = demoEmail?.trim().toLowerCase();
  return Boolean(demo && user?.email && user.email.toLowerCase() === demo);
}
