import { expect, test } from '@playwright/test';
import { ADMIN } from './credentials.js';

const PRODUCT = { title: 'E2E Widget', sku: 'e2e-001', price: '125000', initial: '5' };

/** Collects what a person would call "broken": script errors and server errors (5xx). */
function watchForProblems(page) {
  const problems = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`);
  });
  return problems;
}

async function signIn(page, password = ADMIN.password) {
  // `exact`: the tab panel is labelled "Use email", which a plain "Email" would also match.
  await page.getByLabel('Email', { exact: true }).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

const productRow = (page) => page.getByRole('row', { name: new RegExp(PRODUCT.title) });

test('signs in, adds a product, receives and ships stock, and signs out', async ({ page }) => {
  const problems = watchForProblems(page);

  await test.step('a signed-out visitor is sent to the sign-in page', async () => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  });

  await test.step('sign in with email and password', async () => {
    await signIn(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const me = await page.request.get('/api/auth/me');
    expect((await me.json()).user).toMatchObject({ email: ADMIN.email, role: 'admin' });
  });

  await test.step('open the Products page', async () => {
    await page.getByRole('link', { name: 'Products', exact: true }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
  });

  await test.step('add a product with 5 units of initial stock', async () => {
    await page.getByRole('button', { name: 'Add product' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Add product' });
    await dialog.getByLabel('Title', { exact: true }).fill(PRODUCT.title);
    await dialog.getByLabel('SKU').fill(PRODUCT.sku);
    await dialog.getByLabel('Price (Rial)').fill(PRODUCT.price);
    await dialog.getByRole('combobox', { name: 'Category' }).click();
    await page.getByRole('option', { name: 'General' }).click();
    await dialog.getByLabel(/^Initial quantity/).fill(PRODUCT.initial);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();

    const row = productRow(page);
    await expect(row).toBeVisible();
    await expect(row).toContainText('E2E-001'); // the SKU is stored in capitals
    await expect(row.getByText('125,000 Rial')).toBeVisible(); // whole Rial, with the unit
    await expect(row.getByText('5', { exact: true })).toBeVisible();
  });

  await test.step('receive 10 units: the preview says 5 → 15 and the row shows 15', async () => {
    await page.getByRole('button', { name: `Adjust stock of ${PRODUCT.title}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Adjust stock' });
    await dialog.getByLabel('Quantity to add').fill('10');
    await expect(dialog.getByText(/^Stock:/)).toContainText('5 → 15');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expect(productRow(page).getByText('15', { exact: true })).toBeVisible();
  });

  await test.step('ship 3 units: the preview says 15 → 12 and the row shows 12', async () => {
    await page.getByRole('button', { name: `Adjust stock of ${PRODUCT.title}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Adjust stock' });
    await dialog.getByRole('tab', { name: 'Ship' }).click();
    await dialog.getByLabel('Quantity to remove').fill('3');
    await expect(dialog.getByText(/^Stock:/)).toContainText('15 → 12');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expect(productRow(page).getByText('12', { exact: true })).toBeVisible();
  });

  await test.step('the database holds the same: 12 units and three movements', async () => {
    const list = await page.request.get(`/api/products?search=${PRODUCT.sku}`);
    const { items } = await list.json();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ sku: 'E2E-001', quantity: 12, price: 125000 });

    const history = await page.request.get(`/api/products/${items[0].id}/movements?limit=50`);
    const movements = (await history.json()).items;
    // Newest first: the shipment, the receipt, and the initial stock (also a receipt).
    expect(movements.map((m) => [m.type, m.quantityChange, m.quantityAfter])).toEqual([
      ['ship', -3, 12],
      ['receive', 10, 15],
      ['receive', 5, 5],
    ]);
    expect(movements.every((m) => m.performedBy.name === ADMIN.name)).toBe(true);
  });

  await test.step('sign out: back to sign-in, and the session is really gone', async () => {
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
    expect((await page.request.get('/api/products')).status()).toBe(401);
    await page.goto('/products');
    await expect(page).toHaveURL(/\/login$/);
  });

  expect(problems).toEqual([]);
});

test('a wrong password is refused with a clear message and signs nobody in', async ({ page }) => {
  const problems = watchForProblems(page);
  await page.goto('/login');

  await signIn(page, 'not-the-right-password');

  await expect(page.getByRole('alert')).toContainText('Invalid email or password');
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  expect(problems).toEqual([]);
});

test('a private page sends a signed-out visitor to sign in', async ({ page }) => {
  await page.goto('/products');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
});
