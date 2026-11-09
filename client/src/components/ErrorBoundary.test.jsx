import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense, lazy } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import fa from '@/i18n/locales/fa/common.json';
import { ErrorBoundary } from './ErrorBoundary';

function Boom() {
  throw new Error('render failed');
}

afterEach(() => vi.restoreAllMocks());

describe('ErrorBoundary', () => {
  it('shows its children when nothing fails', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a message and a reload button instead of a blank page when rendering fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload });
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong');
    expect(alert).not.toHaveTextContent('render failed'); // no internals on screen
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('also catches a page whose code failed to download (a lazy import that rejects)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Missing = lazy(() =>
      Promise.reject(new Error('Failed to fetch dynamically imported module')),
    );

    render(
      <ErrorBoundary>
        <Suspense fallback={<p>loading</p>}>
          <Missing />
        </Suspense>
      </ErrorBoundary>,
    );

    return screen.findByRole('alert');
  });

  it('speaks Persian when the language is Persian', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await i18n.changeLanguage('fa');

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: fa.crash.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: fa.crash.reload })).toBeInTheDocument();
  });
});
