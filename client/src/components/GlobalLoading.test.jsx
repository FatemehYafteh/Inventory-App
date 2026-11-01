import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { BAR_DELAY_MS, GlobalLoading, SLOW_DELAY_MS } from './GlobalLoading';

/** A request that finishes when `release()` is called. */
function deferred() {
  let release;
  const promise = new Promise((resolve) => {
    release = () => resolve('done');
  });
  return { promise, release };
}

function Fetcher({ promise, refetchInterval }) {
  useQuery({
    queryKey: ['slow', Boolean(refetchInterval)],
    queryFn: () => promise,
    refetchInterval,
  });
  return null;
}

function Mutator({ promise }) {
  const mutation = useMutation({ mutationFn: () => promise });
  return <button onClick={() => mutation.mutate()}>go</button>;
}

function setup(children) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <GlobalLoading />
      {children}
    </QueryClientProvider>,
  );
}

const advance = (ms) => act(() => vi.advanceTimersByTimeAsync(ms));
/** Lets the request register as in flight, so the thresholds below are counted from its start. */
const settle = () => advance(1);

beforeEach(async () => {
  vi.useFakeTimers();
  await i18n.changeLanguage('en');
});
afterEach(() => vi.useRealTimers());

describe('GlobalLoading', () => {
  it('shows nothing for a request that finishes within 300 ms', async () => {
    const request = deferred();
    setup(<Fetcher promise={request.promise} />);
    await settle();

    await advance(BAR_DELAY_MS - 50);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    request.release();
    await advance(500);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('shows the bar after 300 ms and removes it when the request ends', async () => {
    const request = deferred();
    setup(<Fetcher promise={request.promise} />);
    await settle();

    await advance(BAR_DELAY_MS + 50);
    expect(screen.getByRole('progressbar', { name: 'Loading…' })).toBeInTheDocument();
    request.release();
    await advance(10);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('also covers a slow mutation', async () => {
    const request = deferred();
    setup(<Mutator promise={request.promise} />);
    await settle();
    await act(async () => screen.getByRole('button', { name: 'go' }).click());
    await settle();

    await advance(BAR_DELAY_MS + 50);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    request.release();
    await advance(10);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('says the server may be starting only after a long wait, and clears it afterwards', async () => {
    const request = deferred();
    setup(<Fetcher promise={request.promise} />);
    await settle();

    await advance(SLOW_DELAY_MS - 100);
    expect(screen.queryByText(/server may be starting up/)).not.toBeInTheDocument();
    await advance(200);
    expect(screen.getByText(/server may be starting up/)).toBeInTheDocument();
    request.release();
    await advance(10);
    expect(screen.queryByText(/server may be starting up/)).not.toBeInTheDocument();
  });

  it('ignores polling queries, which nobody is waiting for', async () => {
    const request = deferred();
    setup(<Fetcher promise={request.promise} refetchInterval={2000} />);
    await settle();

    await advance(SLOW_DELAY_MS + 500);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/server may be starting up/)).not.toBeInTheDocument();
  });

  it('shows the message in Persian', async () => {
    await i18n.changeLanguage('fa');
    const request = deferred();
    setup(<Fetcher promise={request.promise} />);
    await settle();

    await advance(SLOW_DELAY_MS + 100);
    expect(screen.getByText(/ممکن است سرور در حال راه‌اندازی باشد/)).toBeInTheDocument();
  });
});
