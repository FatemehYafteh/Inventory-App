import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MovementTypeBadge } from './MovementTypeBadge';

describe('MovementTypeBadge', () => {
  it.each([
    ['receive', 'Receive', 'text-success'],
    ['increment', 'Increment', 'text-success'],
    ['ship', 'Ship', 'text-danger'],
    ['decrement', 'Decrement', 'text-danger'],
  ])('shows %s as a text badge in a token colour', (type, label, colour) => {
    render(<MovementTypeBadge type={type} />);
    expect(screen.getByText(label)).toHaveClass(colour, 'rounded-md', 'border');
  });

  it('keeps an adjustment neutral', () => {
    render(<MovementTypeBadge type="adjust" />);
    const badge = screen.getByText('Adjust');
    expect(badge).toHaveClass('text-foreground');
    expect(badge.className).not.toMatch(/text-(success|danger)/);
  });
});
