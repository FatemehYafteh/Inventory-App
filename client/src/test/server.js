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
  // The dashboard is the landing page of every signed-in test; pages override this when they care.
  http.get('*/api/dashboard', () =>
    HttpResponse.json({
      summary: {
        activeProducts: 0,
        totalUnits: 0,
        inventoryValue: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      },
      lowStock: [],
      recentMovements: [],
    }),
  ),
  // The admin navigation polls this badge count on every page.
  http.get('*/api/users/pending-count', () => HttpResponse.json({ count: 0 })),
);
