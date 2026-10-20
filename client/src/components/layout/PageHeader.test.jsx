import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from '@/components/layout/PageHeader';
import { renderApp } from '@/test/render';

describe('PageHeader', () => {
  it('renders the title as the level-1 heading', () => {
    render(<PageHeader title="Suppliers" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Suppliers' })).toBeInTheDocument();
  });

  it('renders the description and the actions when given', () => {
    render(
      <PageHeader
        title="Categories"
        description="Browse by category."
        actions={<button type="button">Add category</button>}
      />,
    );
    expect(screen.getByText('Browse by category.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add category' })).toBeInTheDocument();
  });

  it('renders nothing extra when there is no description or actions', () => {
    render(<PageHeader title="Users" actions={false} />);
    expect(screen.getByRole('heading', { name: 'Users' }).parentElement.children).toHaveLength(1);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('forwards its ref to the heading, which can be focused by code but not by tabbing', () => {
    const ref = createRef();
    render(<PageHeader ref={ref} title="Categories" />);

    expect(ref.current).toBe(screen.getByRole('heading', { level: 1 }));
    expect(ref.current).toHaveAttribute('tabindex', '-1');
    ref.current.focus();
    expect(ref.current).toHaveFocus();
  });

  it('centres the heading when asked', () => {
    render(<PageHeader title="Page not found" centered />);
    expect(
      screen.getByRole('heading', { name: 'Page not found' }).closest('div').parentElement,
    ).toHaveClass('text-center');
  });
});

describe('NotFoundPage', () => {
  it('shows a level-1 heading and a way home for an unknown address', async () => {
    renderApp({ route: '/no-such-page' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
  });
});
