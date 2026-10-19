import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const pendingUser = {
  ...activeUser,
  id: '3',
  name: 'Pat Pending',
  email: 'pat@example.com',
  role: 'staff',
  status: 'pending',
  telegramConnected: true,
  telegramUsername: 'pat_tg',
};

/** Serves `user` from /me and records the PATCH and password reset bodies. */
function profileHandlers(user) {
  const current = { user };
  const requests = { patch: [], reset: [] };
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: current.user })),
    http.patch('*/api/auth/profile', async ({ request }) => {
      const body = await request.json();
      requests.patch.push(body);
      current.user = { ...current.user, name: body.name.trim() };
      return HttpResponse.json({ user: current.user });
    }),
    http.post('*/api/auth/forgot-password', async ({ request }) => {
      requests.reset.push(await request.json());
      return HttpResponse.json({ message: 'sent' }, { status: 202 });
    }),
  );
  return requests;
}

function signInMethods() {
  return within(screen.getByRole('region', { name: 'Sign-in methods' }));
}

/** Opens Connect Telegram in the sign-in methods once the page has loaded. */
async function startConnect(user) {
  await screen.findByRole('heading', { name: 'Profile' });
  await user.click(signInMethods().getByRole('button', { name: 'Connect Telegram' }));
}

describe('Profile page', () => {
  it('shows an active user their sign-in methods inside the app layout', async () => {
    profileHandlers(activeUser);
    renderApp({ route: '/profile' });

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();

    const methods = signInMethods();
    expect(methods.getByText('ana@example.com')).toBeInTheDocument();
    expect(methods.getByText('Verified')).toBeInTheDocument();
    expect(methods.getByText('Not connected')).toBeInTheDocument();
    expect(methods.getByRole('button', { name: 'Connect Telegram' })).toBeInTheDocument();
  });

  it('shows a pending user the page in a minimal layout, reached from Awaiting approval', async () => {
    profileHandlers(pendingUser);
    const user = userEvent.setup();
    renderApp({ route: '/awaiting-approval' });

    await user.click(await screen.findByRole('link', { name: 'Edit profile / connect Telegram' }));

    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Awaiting approval' })).toBeInTheDocument();
    expect(signInMethods().getByText('Connected as @pat_tg')).toBeInTheDocument();
    expect(signInMethods().queryByRole('button', { name: 'Connect Telegram' })).toBeNull();
  });

  it('says Telegram is connected when the account has no Telegram username', async () => {
    profileHandlers({ ...activeUser, telegramConnected: true, telegramUsername: null });
    renderApp({ route: '/profile' });

    await screen.findByRole('heading', { name: 'Profile' });
    expect(signInMethods().getByText('Connected')).toBeInTheDocument();
  });

  it('connects Telegram with the deep link and code, then shows it connected', async () => {
    profileHandlers(activeUser);
    const verifyBodies = [];
    let polls = 0;
    server.use(
      http.post('*/api/auth/telegram/connect/start', () =>
        HttpResponse.json(
          { requestId: 'req-c', deepLink: 'https://t.me/test_bot?start=tok' },
          { status: 201 },
        ),
      ),
      http.get('*/api/auth/telegram/status', () => {
        polls += 1;
        // Pending until Start is pressed in Telegram, then the code is sent.
        if (polls === 1) return HttpResponse.json({ status: 'pending' });
        return HttpResponse.json({
          status: 'otp_sent',
          telegramUsername: 'ana_tg',
          name: 'Ana',
          codeSentAt: '2026-10-14T10:00:00.000Z',
          codeExpiresIn: 120,
          resendIn: 60,
          attemptsLeft: 3,
        });
      }),
      http.post('*/api/auth/telegram/connect/verify', async ({ request }) => {
        verifyBodies.push(await request.json());
        return HttpResponse.json({
          user: { ...activeUser, telegramConnected: true, telegramUsername: 'ana_tg' },
        });
      }),
    );
    const user = userEvent.setup();
    renderApp({ route: '/profile' });

    await startConnect(user);
    // Connect Telegram is one step in a settings page: no sign-in steps list.
    expect(screen.queryByText('Open the chat and press Start')).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Open Telegram' })).toHaveAttribute(
      'href',
      'https://t.me/test_bot?start=tok',
    );
    await user.type(
      await screen.findByLabelText('Code from Telegram', {}, { timeout: 4000 }),
      '123456',
    );
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await signInMethods().findByText('Connected as @ana_tg')).toBeInTheDocument();
    expect(verifyBodies).toEqual([{ requestId: 'req-c', otp: '123456' }]);
  });

  it('says to contact an admin when the Telegram account belongs to someone else', async () => {
    profileHandlers(activeUser);
    server.use(
      http.post('*/api/auth/telegram/connect/start', () =>
        HttpResponse.json(
          { requestId: 'req-c', deepLink: 'https://t.me/b?start=t' },
          { status: 201 },
        ),
      ),
      http.get('*/api/auth/telegram/status', () =>
        HttpResponse.json({
          status: 'otp_sent',
          telegramUsername: 'ana_tg',
          codeSentAt: '2026-10-14T10:00:00.000Z',
          codeExpiresIn: 120,
          resendIn: 60,
          attemptsLeft: 3,
        }),
      ),
      http.post('*/api/auth/telegram/connect/verify', () =>
        HttpResponse.json(
          {
            message: 'This Telegram account belongs to another user. Contact an admin.',
            code: 'TELEGRAM_OWNED',
          },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: '/profile' });

    await startConnect(user);
    await user.type(await screen.findByLabelText('Code from Telegram'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(
      await screen.findByText('This Telegram account belongs to another user. Contact an admin.'),
    ).toBeInTheDocument();
    expect(signInMethods().getByText('Not connected')).toBeInTheDocument();
  });

  it('keeps the code form after a wrong code when connecting Telegram', async () => {
    profileHandlers(activeUser);
    let starts = 0;
    server.use(
      http.post('*/api/auth/telegram/connect/start', () => {
        starts += 1;
        return HttpResponse.json(
          { requestId: 'req-c', deepLink: 'https://t.me/b?start=t' },
          { status: 201 },
        );
      }),
      http.get('*/api/auth/telegram/status', () =>
        HttpResponse.json({
          status: 'otp_sent',
          telegramUsername: 'ana_tg',
          codeSentAt: '2026-10-14T10:00:00.000Z',
          codeExpiresIn: 120,
          resendIn: 60,
          attemptsLeft: 2,
        }),
      ),
      http.post('*/api/auth/telegram/connect/verify', () =>
        HttpResponse.json(
          { message: 'Wrong code. 2 tries left.', code: 'INVALID_CODE' },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: '/profile' });

    await startConnect(user);
    await user.type(await screen.findByLabelText('Code from Telegram'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Wrong code. 2 tries left.')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(screen.getByLabelText('Code from Telegram')).toBeInTheDocument();
    expect(starts).toBe(1);
  });

  it('saves a new name', async () => {
    const requests = profileHandlers(activeUser);
    const user = userEvent.setup();
    renderApp({ route: '/profile' });

    const name = await screen.findByLabelText('Name');
    expect(name).toHaveValue('Ana Admin');
    await user.clear(name);
    await user.type(name, 'Ana A.');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByText('Name saved.')).toBeInTheDocument();
    expect(requests.patch).toEqual([{ name: 'Ana A.' }]);
  });

  it('shows a validation error for an empty name', async () => {
    const requests = profileHandlers(activeUser);
    const user = userEvent.setup();
    renderApp({ route: '/profile' });

    await user.clear(await screen.findByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(requests.patch).toEqual([]);
  });

  it('sends a password reset email to the account address', async () => {
    const requests = profileHandlers(activeUser);
    const user = userEvent.setup();
    renderApp({ route: '/profile' });

    await user.click(await screen.findByRole('button', { name: 'Send password reset email' }));

    expect(await screen.findByText(/Check ana@example.com for a link/)).toBeInTheDocument();
    expect(requests.reset).toEqual([{ email: 'ana@example.com' }]);
  });

  it('lays the page out as a Profile heading above three titled sections', async () => {
    profileHandlers(activeUser);
    renderApp({ route: '/profile' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
    for (const name of ['Name', 'Sign-in methods', 'Password']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('region', { name: 'Sign-in methods' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Password' })).toBeInTheDocument();
  });

  it('shows a pending user the same sections in the minimal layout', async () => {
    profileHandlers(pendingUser);
    renderApp({ route: '/profile' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
    for (const name of ['Name', 'Sign-in methods', 'Password']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Awaiting approval' })).toBeInTheDocument();
  });

  it('does not name a region after the Name field it contains', async () => {
    profileHandlers(activeUser);
    renderApp({ route: '/profile' });

    expect(await screen.findByLabelText('Name')).toHaveAttribute('id', 'name');
    expect(screen.queryByRole('region', { name: 'Name' })).not.toBeInTheDocument();
  });

  it('is not shown before the profile is complete', async () => {
    profileHandlers({ ...pendingUser, emailVerified: false, profileComplete: false });
    renderApp({ route: '/profile' });

    expect(
      await screen.findByRole('heading', { name: 'Complete your profile' }),
    ).toBeInTheDocument();
  });
});
