import { act, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';
import { THEME_STORAGE_KEY } from '@/theme/theme';
import { useTheme } from '@/theme/useTheme';

const root = document.documentElement;

function signedIn(user) {
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user })),
    http.get('*/api/users/pending-count', () => HttpResponse.json({ count: 0 })),
  );
}

// The theme choice lives in one module-level store, so put it back for the next test.
afterEach(() => {
  const { result } = renderHook(() => useTheme());
  act(() => result.current.setTheme('system'));
});

describe('Theme switcher', () => {
  it('offers Light, Dark and System on the signed-out pages, starting on System', async () => {
    renderApp({ route: '/login' });

    const group = await screen.findByRole('radiogroup', { name: 'Theme' });
    const names = within(group)
      .getAllByRole('radio')
      .map((radio) => radio.getAttribute('value'));

    expect(names).toEqual(['light', 'dark', 'system']);
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();
  });

  it('applies the dark theme at once and keeps the choice in the browser', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await user.click(await screen.findByRole('radio', { name: 'Dark' }));

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(root).toHaveClass('dark');
    expect(root.style.colorScheme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(screen.getByRole('radio', { name: 'Light' }));

    expect(root).not.toHaveClass('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('never calls the server: the choice is not saved on the account', async () => {
    let patched = false;
    server.use(
      http.patch('*/api/auth/profile', () => {
        patched = true;
        return HttpResponse.json({ user: activeUser });
      }),
    );
    signedIn(activeUser);
    const user = userEvent.setup();
    renderApp({ route: '/' });

    await user.click(await screen.findByRole('radio', { name: 'Dark' }));

    expect(patched).toBe(false);
  });

  it('moves between the options with the arrow keys', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await user.click(await screen.findByRole('radio', { name: 'Light' }));
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(root).toHaveClass('dark');
  });

  it('is in the sidebar of a signed-in user, once, in the navigation area', async () => {
    signedIn({ ...activeUser, role: 'admin' });
    renderApp({ route: '/' });

    await screen.findByRole('navigation', { name: 'Main' });

    const groups = screen.getAllByRole('radiogroup', { name: 'Theme' });
    expect(groups).toHaveLength(1);
    expect(screen.getByRole('complementary', { hidden: true })).toContainElement(groups[0]);
  });

  it('keeps the sidebar and the open mobile menu in step, each as its own radio group', async () => {
    signedIn({ ...activeUser, role: 'admin' });
    const user = userEvent.setup();
    renderApp({ route: '/' });

    await user.click(await screen.findByRole('button', { name: 'Open menu' }));
    const menu = await screen.findByRole('dialog');
    const inMenu = within(menu).getByRole('radiogroup', { name: 'Theme' });
    const groups = screen.getAllByRole('radiogroup', { name: 'Theme', hidden: true });
    expect(groups).toHaveLength(2);

    const names = groups.map((group) => group.querySelector('input').name);
    expect(new Set(names).size).toBe(2);

    await user.click(within(inMenu).getByRole('radio', { name: 'Dark' }));

    for (const group of groups) {
      expect(within(group).getByRole('radio', { name: 'Dark', hidden: true })).toBeChecked();
      expect(within(group).getByRole('radio', { name: 'System', hidden: true })).not.toBeChecked();
    }
    expect(root).toHaveClass('dark');
  });

  it('is in the bar a pending user sees', async () => {
    signedIn({ ...activeUser, role: 'staff', status: 'pending' });
    renderApp({ route: '/profile' });

    await screen.findByRole('link', { name: 'Back to Awaiting approval' });

    expect(screen.getByRole('banner')).toContainElement(
      screen.getByRole('radiogroup', { name: 'Theme' }),
    );
  });

  it('is in Persian when the language is Persian', async () => {
    await i18n.changeLanguage('fa');
    renderApp({ route: '/login' });

    const group = await screen.findByRole('radiogroup', { name: 'پوسته' });

    expect(within(group).getByRole('radio', { name: 'تیره' })).toBeInTheDocument();
    expect(within(group).getByRole('radio', { name: 'روشن' })).toBeInTheDocument();
    expect(within(group).getByRole('radio', { name: 'سیستم' })).toBeInTheDocument();
  });
});
