import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import i18n, { LANGUAGE_STORAGE_KEY, initialLanguage } from '@/i18n';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

// The Profile page has the switcher in the navigation and in its Language section; either works.
const english = () => screen.getAllByRole('button', { name: 'English' })[0];
const persian = () => screen.getAllByRole('button', { name: 'فارسی' })[0];

/** Serves `user` from /me and records every PATCH /auth/profile body; `fail` makes it answer 500. */
function profileApi(user, { fail = false } = {}) {
  const patches = [];
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user })),
    http.patch('*/api/auth/profile', async ({ request }) => {
      patches.push(await request.json());
      if (fail) return HttpResponse.json({ message: 'Nope', code: 'INTERNAL' }, { status: 500 });
      return HttpResponse.json({ user: { ...user, ...patches.at(-1) } });
    }),
  );
  return patches;
}

describe('Language switcher', () => {
  it('is on the signed-out pages and keeps the choice in the browser only', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    expect(await screen.findByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(english()).toHaveAttribute('aria-pressed', 'true');

    await user.click(persian());

    expect(persian()).toHaveAttribute('aria-pressed', 'true');
    expect(english()).toHaveAttribute('aria-pressed', 'false');
    expect(i18n.language).toBe('fa');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('fa');
    expect(screen.getByRole('group', { name: 'زبان' })).toBeInTheDocument();
  });

  it('saves the language on the account of a signed-in user', async () => {
    const patches = profileApi(activeUser);
    const user = userEvent.setup();
    renderApp({ route: '/profile' });

    await screen.findByRole('heading', { name: 'Profile' });
    await user.click(persian());

    expect(await screen.findByRole('heading', { name: 'زبان' })).toBeInTheDocument();
    expect(patches).toEqual([{ language: 'fa' }]);
  });

  it('keeps the new language on this device and says so when the save fails', async () => {
    profileApi(activeUser, { fail: true });
    const user = userEvent.setup();
    renderApp({ route: '/profile' });

    await screen.findByRole('heading', { name: 'Profile' });
    await user.click(persian());

    expect(await screen.findByRole('alert')).toHaveTextContent('زبان شما ذخیره نشد');
    expect(i18n.language).toBe('fa');
  });

  it('follows the language saved on the account', async () => {
    profileApi({ ...activeUser, language: 'fa' });
    renderApp({ route: '/profile' });

    expect(await screen.findByRole('heading', { name: 'زبان' })).toBeInTheDocument();
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('fa');
  });

  it('starts from the saved choice, then the browser language, then English', () => {
    expect(initialLanguage()).toBe('en');
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fa');
    expect(initialLanguage()).toBe('fa');
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    expect(initialLanguage()).toBe('en');
  });
});
