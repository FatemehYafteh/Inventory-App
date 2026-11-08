import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { Calendar } from './calendar';

afterEach(() => i18n.changeLanguage('en'));

// 14 October 2026 is 22 Mehr 1405.
const month = new Date('2026-10-14T12:00:00Z');

describe('Calendar', () => {
  it('shows the Gregorian month in English', () => {
    render(<Calendar defaultMonth={month} />);

    expect(screen.getByText('October 2026')).toBeInTheDocument();
  });

  it('writes every day number in Persian digits, the selected days too', async () => {
    await i18n.changeLanguage('fa');
    const { container } = render(
      <Calendar
        mode="range"
        defaultMonth={month}
        selected={{ from: new Date('2026-10-14T12:00:00Z'), to: new Date('2026-10-20T12:00:00Z') }}
      />,
    );

    const days = [...container.querySelectorAll('[role="gridcell"] button')];
    expect(days.length).toBeGreaterThan(28);
    expect(container.querySelectorAll('[aria-selected="true"]').length).toBeGreaterThan(1);
    for (const day of days) expect(day.textContent).toMatch(/^[۰-۹]+$/);
    // 14 October 2026 is 22 Mehr, and 20 October is 28 Mehr.
    expect(container.querySelector('[aria-selected="true"] button').textContent).toBe('۲۲');
  });

  it('shows the Jalali month with Persian digits in Persian, right to left', async () => {
    await i18n.changeLanguage('fa');
    const { container } = render(<Calendar defaultMonth={month} />);

    expect(screen.getByText(/مهر ۱۴۰۵/)).toBeInTheDocument();
    expect(screen.queryByText(/October/)).not.toBeInTheDocument();
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
  });
});
