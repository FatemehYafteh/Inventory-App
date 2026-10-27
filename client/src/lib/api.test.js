import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { ApiError, api, setAccessDeniedHandler, setSessionExpiredHandler } from './api';

describe('api', () => {
  it('sends credentials and the X-Requested-With header', async () => {
    let headers;
    server.use(
      http.get('*/api/ping', ({ request }) => {
        headers = request.headers;
        return HttpResponse.json({ ok: true });
      }),
    );
    expect(await api('/ping')).toEqual({ ok: true });
    expect(headers.get('x-requested-with')).toBe('XMLHttpRequest');
  });

  it('throws ApiError with the server message, code and field errors', async () => {
    server.use(
      http.post('*/api/things', () =>
        HttpResponse.json(
          { message: 'Validation failed', code: 'VALIDATION_ERROR', errors: { name: 'Required' } },
          { status: 400 },
        ),
      ),
    );
    const error = await api('/things', { method: 'POST', body: {} }).catch((err) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: { name: 'Required' },
    });
  });

  it('carries the details of a 409 so pages can read the counts', async () => {
    server.use(
      http.delete('*/api/things/1', () =>
        HttpResponse.json(
          { message: 'Used', code: 'IN_USE', details: { productCount: 2 } },
          { status: 409 },
        ),
      ),
    );
    const error = await api('/things/1', { method: 'DELETE' }).catch((err) => err);
    expect(error.details).toEqual({ productCount: 2 });
  });

  it('refreshes once after a 401 and retries the request', async () => {
    let calls = 0;
    const refresh = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(
      http.get('*/api/data', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ message: 'expired' }, { status: 401 })
          : HttpResponse.json({ value: 42 });
      }),
      http.post('*/api/auth/refresh', refresh),
    );

    expect(await api('/data')).toEqual({ value: 42 });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls).toBe(2);
  });

  it('shares one refresh between parallel 401s', async () => {
    let refreshed = false;
    const refresh = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      refreshed = true;
      return new HttpResponse(null, { status: 204 });
    });
    server.use(
      http.get('*/api/a', () =>
        refreshed ? HttpResponse.json({ a: 1 }) : HttpResponse.json({}, { status: 401 }),
      ),
      http.get('*/api/b', () =>
        refreshed ? HttpResponse.json({ b: 2 }) : HttpResponse.json({}, { status: 401 }),
      ),
      http.post('*/api/auth/refresh', refresh),
    );

    expect(await Promise.all([api('/a'), api('/b')])).toEqual([{ a: 1 }, { b: 2 }]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('reports an expired session when the refresh fails', async () => {
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);
    server.use(http.get('*/api/data', () => HttpResponse.json({}, { status: 401 })));

    await expect(api('/data')).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);
    setSessionExpiredHandler(() => {});
  });

  it('refreshes only once when the retried request is still unauthorized', async () => {
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);
    const refresh = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(
      http.get('*/api/data', () => HttpResponse.json({}, { status: 401 })),
      http.post('*/api/auth/refresh', refresh),
    );

    await expect(api('/data')).rejects.toMatchObject({ status: 401 });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
    setSessionExpiredHandler(() => {});
  });

  it('turns a network failure into an ApiError', async () => {
    server.use(http.get('*/api/data', () => HttpResponse.error()));

    const error = await api('/data').catch((err) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, message: expect.stringMatching(/reach the server/) });
  });

  it('returns null for an empty response', async () => {
    server.use(http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })));

    expect(await api('/auth/logout', { method: 'POST' })).toBeNull();
  });

  it('does not try to refresh after a failed login', async () => {
    const refresh = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ message: 'Invalid email or password' }, { status: 401 }),
      ),
      http.post('*/api/auth/refresh', refresh),
    );
    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      message: 'Invalid email or password',
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not try to refresh after a wrong password on Confirm link', async () => {
    const refresh = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(
      http.post('*/api/auth/link-telegram/confirm', () =>
        HttpResponse.json(
          { code: 'INVALID_PASSWORD', message: 'Incorrect password.' },
          { status: 401 },
        ),
      ),
      http.post('*/api/auth/refresh', refresh),
    );
    await expect(
      api('/auth/link-telegram/confirm', { method: 'POST', body: {} }),
    ).rejects.toMatchObject({ code: 'INVALID_PASSWORD' });
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each(['ACCOUNT_REJECTED', 'ACCOUNT_PENDING', 'PROFILE_INCOMPLETE'])(
    'reports a 403 %s to the access-denied handler without refreshing',
    async (code) => {
      const onDenied = vi.fn();
      setAccessDeniedHandler(onDenied);
      const refresh = vi.fn(() => new HttpResponse(null, { status: 204 }));
      server.use(
        http.get('*/api/data', () => HttpResponse.json({ code, message: 'no' }, { status: 403 })),
        http.post('*/api/auth/refresh', refresh),
      );

      await expect(api('/data')).rejects.toMatchObject({ status: 403, code });
      expect(onDenied).toHaveBeenCalledExactlyOnceWith(code);
      expect(refresh).not.toHaveBeenCalled();
      setAccessDeniedHandler(() => {});
    },
  );

  it('ignores other 403 errors', async () => {
    const onDenied = vi.fn();
    setAccessDeniedHandler(onDenied);
    server.use(
      http.get('*/api/data', () => HttpResponse.json({ code: 'FORBIDDEN' }, { status: 403 })),
    );

    await expect(api('/data')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(onDenied).not.toHaveBeenCalled();
    setAccessDeniedHandler(() => {});
  });
});
