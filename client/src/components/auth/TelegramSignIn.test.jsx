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

const codeSent = {
  status: 'otp_sent',
  telegramUsername: 'nina_n',
  name: 'Nina Novak',
  codeSentAt: '2026-10-14T10:00:00.000Z',
  codeExpiresIn: 120,
  resendIn: 60,
  attemptsLeft: 3,
};

/** Opens the Telegram tab and clicks Continue with Telegram. */
async function startTelegram(user) {
  await user.click(await screen.findByRole('tab', { name: 'Telegram' }));
  await user.click(await screen.findByRole('button', { name: 'Continue with Telegram' }));
}

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
    const verifyBodies = telegramHandlers([{ status: 'pending' }, codeSent], placeholderUser);
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await startTelegram(user);

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

  it('shows a wrong code, then starts again with a new link that replaces the request', async () => {
    const startBodies = [];
    server.use(
      http.post('*/api/auth/telegram/start', async ({ request }) => {
        startBodies.push(await request.json().catch(() => undefined));
        const requestId = `req-${startBodies.length}`;
        return HttpResponse.json(
          { requestId, deepLink: `https://t.me/test_bot?start=${requestId}` },
          { status: 201 },
        );
      }),
      http.get('*/api/auth/telegram/status', ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.get('requestId') === 'req-1'
            ? codeSent
            : { status: 'pending' },
        ),
      ),
      http.post('*/api/auth/telegram/verify', () =>
        HttpResponse.json(
          { message: 'Wrong code. 2 tries left.', code: 'INVALID_CODE' },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await startTelegram(user);
    const input = await screen.findByLabelText('Code from Telegram');
    await user.type(input, '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Wrong code. 2 tries left.')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');

    const open = await screen.findByRole('link', { name: 'Open Telegram' }, { timeout: 3000 });
    expect(open).toHaveAttribute('href', 'https://t.me/test_bot?start=req-2');
    expect(screen.getByRole('alert')).toHaveTextContent('Wrong code. 2 tries left.');
    expect(screen.queryByLabelText('Code from Telegram')).not.toBeInTheDocument();
    expect(startBodies[1]).toEqual({ previousRequestId: 'req-1' });
  });

  it('names the person when they have no Telegram username', async () => {
    telegramHandlers([{ ...codeSent, telegramUsername: null }]);
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await startTelegram(user);

    expect(await screen.findByText('We sent a code to Nina Novak in Telegram')).toBeInTheDocument();
  });

  it('offers to start again when the request expires', async () => {
    telegramHandlers([{ status: 'expired' }]);
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await startTelegram(user);

    expect(await screen.findByText('This sign-in link has expired.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start again' })).toBeInTheDocument();
  });

  it('shows a QR code of the deep link from the md breakpoint up', async () => {
    telegramHandlers([{ status: 'pending' }]);
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await startTelegram(user);

    const qr = await screen.findByRole('img', { name: 'QR code to open Telegram on your phone' });
    expect(qr.closest('[data-qr]')).toHaveClass('hidden', 'md:flex');
  });

  it('counts down the code expiry and the resend button, then resends', async () => {
    telegramHandlers([{ ...codeSent, codeExpiresIn: 118, resendIn: 0 }]);
    let resends = 0;
    server.use(
      http.post('*/api/auth/telegram/resend', async ({ request }) => {
        resends += 1;
        expect(await request.json()).toEqual({ requestId: 'req-1' });
        return HttpResponse.json({
          ...codeSent,
          codeSentAt: '2026-10-14T10:01:00.000Z',
          codeExpiresIn: 120,
          resendIn: 60,
        });
      }),
    );
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await startTelegram(user);
    expect(await screen.findByText('Code expires in 1:58')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send a new code' }));

    expect(await screen.findByRole('button', { name: 'Send a new code in 60s' })).toBeDisabled();
    expect(screen.getByText('Code expires in 2:00')).toBeInTheDocument();
    expect(resends).toBe(1);
  });

  it('tells the person when the code has expired', async () => {
    telegramHandlers([{ ...codeSent, codeExpiresIn: 0, resendIn: 0 }]);
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await startTelegram(user);

    expect(await screen.findByText('This code has expired.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send a new code' })).toBeEnabled();
  });

  it('ends the flow after the third wrong code, with no new code offered', async () => {
    const statuses = [{ ...codeSent, attemptsLeft: 1, resendIn: 40 }];
    telegramHandlers(statuses);
    server.use(
      http.post('*/api/auth/telegram/verify', () => {
        statuses[0] = { ...codeSent, attemptsLeft: 0, resendIn: 40 };
        return HttpResponse.json(
          { message: 'Too many wrong codes.', code: 'TOO_MANY_ATTEMPTS' },
          { status: 400 },
        );
      }),
    );
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await startTelegram(user);
    await user.type(await screen.findByLabelText('Code from Telegram'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Too many wrong codes. Try again later.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Code from Telegram')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send a new code/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open Telegram' })).not.toBeInTheDocument();
  });

  it('tells a Telegram account locked by wrong codes to try again later', async () => {
    telegramHandlers([{ status: 'locked' }]);
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await startTelegram(user);

    expect(await screen.findByText('Too many wrong codes. Try again later.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Code from Telegram')).not.toBeInTheDocument();
  });

  it('shows the generic refusal to a rejected Telegram user', async () => {
    telegramHandlers([{ status: 'refused' }]);
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await startTelegram(user);

    expect(await screen.findByText('Access denied, contact an admin.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Code from Telegram')).not.toBeInTheDocument();
  });

  it('tells the person when too many codes were requested', async () => {
    telegramHandlers([{ status: 'rate_limited' }]);
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await startTelegram(user);

    expect(
      await screen.findByText('Too many codes requested. Try again in an hour.'),
    ).toBeInTheDocument();
  });

  it('explains the way in before starting, then follows the person through it', async () => {
    telegramHandlers([{ status: 'pending' }, codeSent]);
    const user = userEvent.setup();
    renderApp({ route: '/login' });
    await user.click(await screen.findByRole('tab', { name: 'Telegram' }));

    expect(screen.getByText(/No password needed/)).toBeInTheDocument();
    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(2);
    expect(steps.some((step) => step.getAttribute('aria-current') === 'step')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Continue with Telegram' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Waiting for you to press Start in Telegram…',
    );
    expect(screen.getByText('Open the chat and press Start').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );

    expect(
      await screen.findByText('We sent a code to @nina_n in Telegram', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Enter the 6-digit code we send you').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText('Open the chat and press Start').closest('li')).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('is offered on the Register page too', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/register' });
    await user.click(await screen.findByRole('tab', { name: 'Telegram' }));
    expect(
      await screen.findByRole('button', { name: 'Continue with Telegram' }),
    ).toBeInTheDocument();
  });

  it('keeps the request going while the person looks at the Email tab', async () => {
    telegramHandlers([{ status: 'pending' }]);
    const user = userEvent.setup();
    renderApp({ route: '/login' });
    await startTelegram(user);
    expect(await screen.findByRole('link', { name: 'Open Telegram' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Email' }));
    expect(screen.queryByRole('link', { name: 'Open Telegram' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Telegram' }));

    expect(await screen.findByRole('link', { name: 'Open Telegram' })).toBeInTheDocument();
  });
});
