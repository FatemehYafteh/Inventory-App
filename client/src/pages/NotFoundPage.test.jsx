import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';

describe('NotFoundPage', () => {
  it('names the problem, explains it and links home, with the brand', async () => {
    renderApp({ route: '/no-such-page' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    expect(screen.getByText(/does not exist or has moved/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
    expect(screen.getByText('Anbar')).toBeInTheDocument();
  });
});
