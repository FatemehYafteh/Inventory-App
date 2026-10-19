import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '@/components/StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['active', 'Active', 'bg-success-soft'],
    ['in_stock', 'In stock', 'bg-success-soft'],
    ['pending', 'Pending', 'bg-warning-soft'],
    ['low_stock', 'Low stock', 'bg-warning-soft'],
    ['rejected', 'Rejected', 'bg-danger-soft'],
    ['out_of_stock', 'Out of stock', 'bg-danger-soft'],
    ['inactive', 'Inactive', 'text-foreground'],
    ['archived', 'Archived', 'text-foreground'],
  ])('shows %s as the text "%s" with the %s colour', (status, text, colourClass) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(text)).toHaveClass(colourClass);
  });

  it('keeps the given text instead of the default label', () => {
    render(<StatusBadge status="rejected" label="rejected" />);
    const badge = screen.getByText('rejected');
    expect(badge).toHaveClass('bg-danger-soft');
    expect(screen.queryByText('Rejected')).not.toBeInTheDocument();
  });

  it('shows an unknown status as it is, in the plain outline style', () => {
    render(<StatusBadge status="on_hold" />);
    expect(screen.getByText('on_hold')).toHaveClass('text-foreground');
  });
});
