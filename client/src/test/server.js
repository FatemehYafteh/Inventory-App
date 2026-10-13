import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

export const activeUser = {
  id: '1',
  name: 'Ana Admin',
  email: 'ana@example.com',
  emailVerified: true,
  telegramConnected: false,
  telegramUsername: null,
  role: 'admin',
  status: 'active',
  profileComplete: true,
};

export const notAuthenticated = () =>
  HttpResponse.json(
    { message: 'Please log in to continue.', code: 'NOT_AUTHENTICATED' },
    { status: 401 },
  );

// Default: no session. Tests override handlers with server.use(...).
export const server = setupServer(
  http.get('*/api/auth/me', notAuthenticated),
  http.post('*/api/auth/refresh', () =>
    HttpResponse.json({ message: 'Session expired', code: 'INVALID_SESSION' }, { status: 401 }),
  ),
  http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
);
