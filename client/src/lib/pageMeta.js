// What the browser tab and search engines get for each route. The app is one HTML page, so
// without this every route is titled just "Anbar" and every page may be indexed.

/** Route path -> translation key of its title (the same text as the page heading or nav). */
export const PAGE_TITLES = Object.freeze({
  '/': 'layout.nav.dashboard',
  '/products': 'layout.nav.products',
  '/movements': 'layout.nav.movements',
  '/categories': 'layout.nav.categories',
  '/suppliers': 'layout.nav.suppliers',
  '/users': 'layout.nav.users',
  '/profile': 'profile.title',
  '/login': 'auth.login.title',
  '/register': 'auth.register.title',
  '/forgot-password': 'auth.forgot.title',
  '/reset-password': 'auth.reset.title',
  '/verify-email': 'auth.verify.title',
  '/confirm-link': 'auth.confirmLink.title',
  '/complete-profile': 'auth.completeProfile.title',
  '/awaiting-approval': 'auth.awaiting.title',
});

export const NOT_FOUND_TITLE = 'layout.notFound.title';

/**
 * Only the public entry pages may appear in search results. The rest are private, or carry a
 * one-time token in the URL (reset password, verify email, confirm link).
 */
export const INDEXABLE_PATHS = Object.freeze(['/login', '/register']);

function normalize(pathname) {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/** The translation key of the title for `pathname`. */
export function titleKeyFor(pathname) {
  return PAGE_TITLES[normalize(pathname)] ?? NOT_FOUND_TITLE;
}

/** "Products · Anbar"; just the brand when there is no page title. */
export function documentTitle(pageTitle, brand) {
  return pageTitle ? `${pageTitle} · ${brand}` : brand;
}

export function isIndexable(pathname) {
  return INDEXABLE_PATHS.includes(normalize(pathname));
}
