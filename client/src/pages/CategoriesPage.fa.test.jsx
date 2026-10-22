import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin' };
const tools = { id: 'c1', title: 'Tools', description: 'Hand tools', productCount: 3 };

function api(items) {
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: admin })),
    http.get('*/api/users/pending-count', () => HttpResponse.json({ count: 0 })),
    http.get('*/api/categories', () => HttpResponse.json({ items })),
  );
}

describe('Categories page in Persian', () => {
  it('shows the heading, card texts and in-use reason in Persian', async () => {
    await i18n.changeLanguage('fa');
    api([tools]);
    renderApp({ route: '/categories' });

    expect(await screen.findByRole('heading', { name: 'دسته‌بندی‌ها' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Tools' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'افزودن دسته‌بندی' })).toBeInTheDocument();
    expect(screen.getByText(/محصول/, { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ویرایش Tools' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حذف Tools' })).toBeDisabled();

    expect(screen.queryByText('Add category')).not.toBeInTheDocument();
    expect(screen.queryByText('3 products')).not.toBeInTheDocument();
  });

  it('shows the empty state and the add form in Persian', async () => {
    await i18n.changeLanguage('fa');
    api([]);
    const user = userEvent.setup();
    renderApp({ route: '/categories' });

    expect(await screen.findByText('هنوز دسته‌بندی‌ای وجود ندارد.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'افزودن دسته‌بندی' }));
    expect(await screen.findByLabelText('عنوان')).toBeInTheDocument();
    expect(screen.getByLabelText('توضیحات')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ذخیره' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'لغو' })).toBeInTheDocument();
    expect(screen.queryByText('No categories yet.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});
