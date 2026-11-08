import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { documentTitle, isIndexable, titleKeyFor } from '@/lib/pageMeta';

const ROBOTS_SELECTOR = 'meta[name="robots"]';

/** Adds, or removes, `<meta name="robots" content="noindex, nofollow">` in the head. */
function setNoIndex(noIndex) {
  let meta = document.head.querySelector(ROBOTS_SELECTOR);
  if (!noIndex) {
    meta?.remove();
    return;
  }
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'robots');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', 'noindex, nofollow');
}

/**
 * Keeps the tab title ("Products · Anbar") and the robots meta in step with the route and the
 * language. Renders nothing. The title follows the page the person ends up on, so a redirect
 * by a route guard shows the title of the page they were sent to.
 */
export function PageMeta() {
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = documentTitle(t(titleKeyFor(pathname)), t('brand.name'));
    setNoIndex(!isIndexable(pathname));
  }, [pathname, t, i18n.language]);

  return null;
}
