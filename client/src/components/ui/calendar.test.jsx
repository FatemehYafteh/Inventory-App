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

  it('shows the Jalali month with Persian digits in Persian, right to left', async () => {
    await i18n.changeLanguage('fa');
    const { container } = render(<Calendar defaultMonth={month} />);

    expect(screen.getByText(/مهر ۱۴۰۵/)).toBeInTheDocument();
    expect(screen.queryByText(/October/)).not.toBeInTheDocument();
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
  });
});
