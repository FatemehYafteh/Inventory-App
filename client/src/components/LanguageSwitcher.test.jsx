import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n, { LANGUAGE_STORAGE_KEY, initialLanguage } from '@/i18n';
import { renderApp } from '@/test/render';
import { activeUser, notAuthenticated, server } from '@/test/server';

const english = () => screen.getByRole('button', { name: 'English' });
const persian = () => screen.getByRole('button', { name: 'فارسی' });

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

  it('is the only place to change the language: the Profile page has no second switcher', async () => {
    profileApi(activeUser);
    renderApp({ route: '/profile' });

    await screen.findByRole('heading', { name: 'Profile' });

    expect(screen.getAllByRole('group', { name: 'Language' })).toHaveLength(1);
  });

  it('saves the language on the account of a signed-in user', async () => {
    const patches = profileApi(activeUser);
    const user = userEvent.setup();
    renderApp({ route: '/profile' });

    await screen.findByRole('heading', { name: 'Profile' });
    await user.click(persian());

    expect(await screen.findByRole('heading', { name: 'پروفایل' })).toBeInTheDocument();
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

    expect(await screen.findByRole('heading', { name: 'پروفایل' })).toBeInTheDocument();
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

describe('Language when signing in', () => {
  afterEach(() => vi.unstubAllEnvs());

  /** No session until POST /auth/login answers with `account`. Records profile PATCH bodies. */
  function signInApi(account) {
    const patches = [];
    let signedIn = false;
    server.use(
      http.get('*/api/auth/me', () =>
        signedIn ? HttpResponse.json({ user: account }) : notAuthenticated(),
      ),
      http.post('*/api/auth/login', () => {
        signedIn = true;
        return HttpResponse.json({ user: account });
      }),
      http.patch('*/api/auth/profile', async ({ request }) => {
        patches.push(await request.json());
        return HttpResponse.json({ user: { ...account, ...patches.at(-1) } });
      }),
    );
    return patches;
  }

  async function chooseEnglishAndSignIn() {
    await i18n.changeLanguage('fa');
    const user = userEvent.setup();
    renderApp({ route: '/login' });
    await user.click(await screen.findByRole('button', { name: 'English' }));
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Password'), 'a-long-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
  }

  it('keeps the language chosen on the login page and saves it on the account', async () => {
    const patches = signInApi({ ...activeUser, language: 'fa' });

    await chooseEnglishAndSignIn();

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(i18n.language).toBe('en');
    await waitFor(() => expect(patches).toEqual([{ language: 'en' }]));
  });

  it('saves nothing when the account already has that language', async () => {
    const patches = signInApi({ ...activeUser, language: 'en' });

    await chooseEnglishAndSignIn();

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(patches).toEqual([]);
  });

  it('keeps the browser language for the shared demo account and never saves it', async () => {
    vi.stubEnv('VITE_DEMO_EMAIL', activeUser.email);
    const patches = signInApi({ ...activeUser, language: 'fa' });

    await chooseEnglishAndSignIn();

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(i18n.language).toBe('en');

    await userEvent.setup().click(persian());
    expect(i18n.language).toBe('fa');
    expect(patches).toEqual([]);
  });

  it('does not follow the language saved on the demo account when the app opens', async () => {
    vi.stubEnv('VITE_DEMO_EMAIL', activeUser.email);
    profileApi({ ...activeUser, language: 'fa' });
    renderApp({ route: '/profile' });

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(i18n.language).toBe('en');
  });
});

