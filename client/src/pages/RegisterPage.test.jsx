import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const GENERIC = {
  message: 'If this email can be used, we have sent a verification link. Check your inbox.',
};

async function openRegister() {
  const user = userEvent.setup();
  renderApp({ route: '/register' });
  await screen.findByRole('heading', { name: 'Create an account' });
  return user;
}

async function fill(user, values) {
  for (const [label, value] of Object.entries(values)) {
    if (value) await user.type(screen.getByLabelText(label), value);
  }
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('RegisterPage', () => {
  it('is reachable from the login page', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/login' });
    await user.click(await screen.findByRole('link', { name: 'Create an account' }));
    expect(await screen.findByRole('heading', { name: 'Create an account' })).toBeInTheDocument();
  });

  it('shows validation messages from the shared schema', async () => {
    const user = await openRegister();
    await fill(user, { Email: 'nope', Password: 'short', 'Confirm password': 'other' });

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 10 characters')).toBeInTheDocument();
  });

  it('rejects common passwords and a mismatched confirmation', async () => {
    const user = await openRegister();
    await fill(user, {
      Name: 'Nora',
      Email: 'nora@example.com',
      Password: 'password123',
      'Confirm password': 'password124',
    });

    expect(
      await screen.findByText('This password is too common. Choose another one.'),
    ).toBeInTheDocument();
  });

  it('flags a confirmation that does not match', async () => {
    const user = await openRegister();
    await fill(user, {
      Name: 'Nora',
      Email: 'nora@example.com',
      Password: 'violet-harbor-lantern',
      'Confirm password': 'violet-harbor-lantern!',
    });
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
  });

  it('submits and shows the check-your-email screen with a resend cooldown', async () => {
    let sent;
    server.use(
      http.post('*/api/auth/register', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(GENERIC, { status: 202 });
      }),
    );
    const user = await openRegister();
    await fill(user, {
      Name: '  Nora  ',
      Email: ' Nora@Example.com ',
      Password: 'violet-harbor-lantern',
      'Confirm password': 'violet-harbor-lantern',
    });

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText('nora@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resend email in \d+s/ })).toBeDisabled();
    expect(sent).toEqual({
      name: 'Nora',
      email: 'nora@example.com',
      password: 'violet-harbor-lantern',
      confirmPassword: 'violet-harbor-lantern',
    });
  });

  it('shows server field errors on the matching field', async () => {
    server.use(
      http.post('*/api/auth/register', () =>
        HttpResponse.json(
          { message: 'Validation failed', errors: { email: 'Enter a valid email address' } },
          { status: 400 },
        ),
      ),
    );
    const user = await openRegister();
    await fill(user, {
      Name: 'Nora',
      Email: 'nora@example.com',
      Password: 'violet-harbor-lantern',
      'Confirm password': 'violet-harbor-lantern',
    });

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('explains rate limiting', async () => {
    server.use(
      http.post('*/api/auth/register', () =>
        HttpResponse.json({ message: 'Too many', code: 'RATE_LIMITED' }, { status: 429 }),
      ),
    );
    const user = await openRegister();
    await fill(user, {
      Name: 'Nora',
      Email: 'nora@example.com',
      Password: 'violet-harbor-lantern',
      'Confirm password': 'violet-harbor-lantern',
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
  });
});
