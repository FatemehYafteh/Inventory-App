import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import fa from '@/i18n/locales/fa/auth.json';
import faErrors from '@/i18n/locales/fa/errors.json';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const codeSent = {
  status: 'otp_sent',
  telegramUsername: 'nina_n',
  name: 'Nina Novak',
  codeSentAt: '2026-10-14T10:00:00.000Z',
  codeExpiresIn: 120,
  resendIn: 60,
  attemptsLeft: 3,
};

describe('Telegram sign-in in Persian', () => {
  it('shows "wrong code, N tries left" in Persian, not the server English text', async () => {
    server.use(
      http.post('*/api/auth/telegram/start', () =>
        HttpResponse.json(
          { requestId: 'req-1', deepLink: 'https://t.me/test_bot?start=tok' },
          { status: 201 },
        ),
      ),
      http.get('*/api/auth/telegram/status', () => HttpResponse.json(codeSent)),
      http.post('*/api/auth/telegram/verify', () =>
        HttpResponse.json(
          { message: 'Wrong code. 2 tries left.', code: 'INVALID_CODE' },
          { status: 400 },
        ),
      ),
    );
    await i18n.changeLanguage('fa');
    const user = userEvent.setup();
    renderApp({ route: '/login' });

    await user.click(await screen.findByRole('tab', { name: fa.methods.telegram }));
    await user.click(await screen.findByRole('button', { name: fa.telegram.continueWith }));
    const input = await screen.findByLabelText(fa.telegram.codeLabel);
    await user.type(input, '000000');
    await user.click(screen.getByRole('button', { name: fa.telegram.verify }));

    expect(
      await screen.findByText(faErrors.messages.TELEGRAM_WRONG_CODE_2_LEFT),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Wrong code/)).not.toBeInTheDocument();
  });
});
