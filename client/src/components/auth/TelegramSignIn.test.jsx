import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const placeholderUser = {
  ...activeUser,
  id: '2',
  name: 'Nina Novak',
  email: null,
  emailVerified: false,
  telegramConnected: true,
  telegramUsername: 'nina_n',
  role: 'staff',
  status: 'pending',
  profileComplete: false,
};

/** Status answers in order; the last one repeats. */
function telegramHandlers(statuses, verifiedUser) {
  let call = 0;
  const verifyBodies = [];
  server.use(
    http.post('*/api/auth/telegram/start', () =>
      HttpResponse.json(
        { requestId: 'req-1', deepLink: 'https://t.me/test_bot?start=tok' },
        { status: 201 },
      ),
    ),
    http.get('*/api/auth/telegram/status', () => {
      const body = statuses[Math.min(call, statuses.length - 1)];
      call += 1;
      return HttpResponse.json(body);
    }),
    http.post('*/api/auth/telegram/verify', async ({ request }) => {
      verifyBodies.push(await request.json());
      // The real server sets the session cookies here; from now on /me knows the user.
      server.use(http.get('*/api/auth/me', () => HttpResponse.json({ user: verifiedUser })));
      return HttpResponse.json({ user: verifiedUser });
    }),
  );
  return verifyBodies;
}

describe('Continue with Telegram', () => {
  it('signs a new Telegram user in and sends them to Complete profile', async () => {
    const verifyBodies = telegramHandlers(
      [
        { status: 'pending' },
        { status: 'otp_sent', telegramUsername: 'nina_n', name: 'Nina Novak' },
      ],
      placeholderUser,
    );
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await user.click(await screen.findByRole('button', { name: 'Continue with Telegram' }));

    const open = await screen.findByRole('link', { name: 'Open Telegram' });
    expect(open).toHaveAttribute('href', 'https://t.me/test_bot?start=tok');

    expect(
      await screen.findByText('We sent a code to @nina_n in Telegram', {}, { timeout: 4000 }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Code from Telegram'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(
      await screen.findByRole('heading', { name: 'Complete your profile' }),
    ).toBeInTheDocument();
    expect(verifyBodies).toEqual([{ requestId: 'req-1', otp: '123456' }]);
  });

  it('shows a rejected code on the code field and stays on the page', async () => {
    telegramHandlers([{ status: 'otp_sent', telegramUsername: 'nina_n', name: 'Nina Novak' }]);
    server.use(
      http.post('*/api/auth/telegram/verify', () =>
        HttpResponse.json(
          { message: 'This code is invalid or has expired.', code: 'INVALID_CODE' },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await user.click(await screen.findByRole('button', { name: 'Continue with Telegram' }));
    const input = await screen.findByLabelText('Code from Telegram');
    await user.type(input, '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('This code is invalid or has expired.')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('names the person when they have no Telegram username', async () => {
    telegramHandlers([{ status: 'otp_sent', telegramUsername: null, name: 'Nina Novak' }]);
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await user.click(await screen.findByRole('button', { name: 'Continue with Telegram' }));

    expect(await screen.findByText('We sent a code to Nina Novak in Telegram')).toBeInTheDocument();
  });

  it('offers to start again when the request expires', async () => {
    telegramHandlers([{ status: 'expired' }]);
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await user.click(await screen.findByRole('button', { name: 'Continue with Telegram' }));

    expect(await screen.findByText('This sign-in link has expired.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start again' })).toBeInTheDocument();
  });

  it('is offered on the Register page too', async () => {
    renderApp({ route: '/register' });
    expect(
      await screen.findByRole('button', { name: 'Continue with Telegram' }),
    ).toBeInTheDocument();
  });
});
