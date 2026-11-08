import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { PAGE_TITLES } from '@/lib/pageMeta';
import { renderApp } from '@/test/render';

const robots = () => document.head.querySelector('meta[name="robots"]');

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('PageMeta', () => {
  it('titles the login page and lets it be indexed', async () => {
    renderApp({ route: '/login' });

    await waitFor(() => expect(document.title).toBe('Log in · Anbar'));
    expect(robots()).toBeNull();
  });

  it('keeps pages opened from email links out of search results', async () => {
    renderApp({ route: '/reset-password?token=one-time' });

    await waitFor(() => expect(document.title).toBe('Choose a new password · Anbar'));
    expect(robots()).toHaveAttribute('content', 'noindex, nofollow');
  });

  it('shows the title of the page a guard redirects to', async () => {
    renderApp({ route: '/products' });

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Log in · Anbar'));
    expect(robots()).toBeNull();
  });

  it('titles an unknown page as not found, and marks it noindex', async () => {
    renderApp({ route: '/no-such-page' });

    await waitFor(() => expect(document.title).toBe('Page not found · Anbar'));
    expect(robots()).toHaveAttribute('content', 'noindex, nofollow');
  });

  it('follows the language', async () => {
    await i18n.changeLanguage('fa');
    renderApp({ route: '/login' });

    await waitFor(() => expect(document.title).toBe('ورود · انبار'));
  });

  it('has a translated title for every route in both languages', () => {
    for (const language of ['en', 'fa']) {
      for (const key of Object.values(PAGE_TITLES)) {
        expect(i18n.exists(key, { lng: language }), `${language}: ${key}`).toBe(true);
      }
    }
  });
});
