import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';
import { activeUser, server } from '@/test/server';

const admin = { ...activeUser, id: 'a1', name: 'Ana Admin', role: 'admin', status: 'active' };

function person(overrides) {
  return {
    id: overrides.name,
    email: `${overrides.name.split(' ')[0].toLowerCase()}@example.com`,
    emailVerified: true,
    telegramUsername: null,
    hasPassword: true,
    hasTelegram: false,
    role: 'staff',
    status: 'pending',
    profileComplete: true,
    createdAt: '2026-09-01T10:00:00.000Z',
    lastLoginAt: null,
    statusChangedAt: null,
    statusChangedBy: null,
    statusReason: null,
    ...overrides,
  };
}

const complete = (user) => user.profileComplete;

/** An in-memory Users API that follows sub-PRD 04 section 5. Records every call. */
function usersApi(initial, { me = admin } = {}) {
  const state = { users: [...initial], lists: [], patches: [], failNext: null, history: {} };

  function matching(params) {
    const status = params.get('status');
    const search = params.get('search')?.toLowerCase();
    return state.users.filter((user) => {
      if (status && user.status !== status) return false;
      if (status === 'pending' && complete(user) === (params.get('incomplete') === 'true')) {
        return false;
      }
      if (search) {
        const text = [user.name, user.email, user.telegramUsername].join(' ').toLowerCase();
        if (!text.includes(search)) return false;
      }
      return true;
    });
  }

  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json({ user: me })),
    http.get('*/api/users/pending-count', () =>
      HttpResponse.json({
        count: state.users.filter((user) => user.status === 'pending' && complete(user)).length,
      }),
    ),
    http.get('*/api/users/:id', ({ params }) => {
      const user = state.users.find((candidate) => candidate.id === params.id);
      if (!user) {
        return HttpResponse.json(
          { code: 'NOT_FOUND', message: 'User not found.' },
          { status: 404 },
        );
      }
      return HttpResponse.json({ user, history: state.history[user.id] ?? [] });
    }),
    http.get('*/api/users', ({ request }) => {
      const params = new URL(request.url).searchParams;
      state.lists.push(Object.fromEntries(params));
      if (state.failList) return HttpResponse.json({ message: 'boom' }, { status: 500 });
      const page = Number(params.get('page') ?? 1);
      const limit = Number(params.get('limit') ?? 20);
      const all = matching(params);
      return HttpResponse.json({
        items: all.slice((page - 1) * limit, page * limit),
        total: all.length,
        page,
        limit,
      });
    }),
    http.patch('*/api/users/:id/:field', async ({ params, request }) => {
      const body = await request.json();
      state.patches.push({ id: params.id, field: params.field, body });
      if (state.failNext) {
        const failure = state.failNext;
        state.failNext = null;
        return HttpResponse.json(failure.body, { status: failure.status });
      }
      const user = state.users.find((candidate) => candidate.id === params.id);
      if (params.field === 'status') Object.assign(user, { status: body.status });
      else Object.assign(user, { role: body.role });
      return HttpResponse.json({ user });
    }),
  );
  return state;
}

const pat = person({
  name: 'Pat Pending',
  telegramUsername: 'pat_tg',
  hasTelegram: true,
  lastLoginAt: '2026-09-20T10:00:00.000Z',
});
const quinn = person({ name: 'Quinn Queue', emailVerified: true });
const ivy = person({ name: 'Ivy Unfinished', emailVerified: false, profileComplete: false });
const ana = person({ ...admin, status: 'active', role: 'admin', hasPassword: true });
const sam = person({ name: 'Sam Staff', status: 'active' });
const rex = person({ name: 'Rex Rejected', status: 'rejected', statusReason: 'Not on the team' });

const everyone = () => [pat, quinn, ivy, ana, sam, rex].map((user) => ({ ...user }));

const rowOf = (name) => screen.getByRole('row', { name: new RegExp(name) });
const waitForRow = (name) => screen.findByRole('row', { name: new RegExp(name) });

async function open(route = '/users', options) {
  const api = usersApi(everyone(), options);
  renderApp({ route });
  return api;
}

describe('UsersPage access', () => {
  it('shows the Users link only to admins, and sends staff away from the page', async () => {
    usersApi(everyone(), { me: { ...admin, role: 'staff' } });
    renderApp({ route: '/users' });

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Users/ })).not.toBeInTheDocument();
  });

  it('is reachable from the navigation for an admin', async () => {
    const user = userEvent.setup();
    await open('/');

    await user.click(await screen.findByRole('link', { name: /Users/ }));

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
  });
});

describe('UsersPage tabs and table', () => {
  it('opens on Pending with the complete profiles waiting for approval', async () => {
    const api = await open();

    expect(await waitForRow('Pat Pending')).toBeInTheDocument();
    expect(rowOf('Quinn Queue')).toBeInTheDocument();
    expect(screen.queryByText('Ivy Unfinished')).not.toBeInTheDocument();
    expect(screen.queryByText('Sam Staff')).not.toBeInTheDocument();
    expect(api.lists[0]).toMatchObject({ status: 'pending', page: '1', limit: '20' });
    expect(screen.getByRole('tab', { name: /Pending/, selected: true })).toBeInTheDocument();
  });

  it('shows name, email with its verified state, Telegram, sign-in methods, role, status, dates', async () => {
    await open();
    const pending = within(await waitForRow('Pat Pending'));

    expect(pending.getByText('pat@example.com')).toBeInTheDocument();
    expect(pending.getByText('Verified')).toBeInTheDocument();
    expect(pending.getByText('@pat_tg')).toBeInTheDocument();
    expect(pending.getByText('Email')).toBeInTheDocument();
    expect(pending.getByText('Telegram')).toBeInTheDocument();
    expect(pending.getByText('staff')).toBeInTheDocument();
    expect(pending.getByText('pending')).toBeInTheDocument();
    expect(pending.getAllByText(/2026/)).toHaveLength(2);
    expect(within(rowOf('Quinn Queue')).getByText('Never')).toBeInTheDocument();
  });

  it('switches between Pending, Active and Rejected', async () => {
    const user = userEvent.setup();
    const api = await open();
    await waitForRow('Pat Pending');

    await user.click(screen.getByRole('tab', { name: /Active/ }));
    expect(await waitForRow('Sam Staff')).toBeInTheDocument();
    expect(screen.queryByText('Pat Pending')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Rejected/ }));
    expect(await waitForRow('Rex Rejected')).toBeInTheDocument();
    expect(api.lists.map((list) => list.status)).toEqual(
      expect.arrayContaining(['pending', 'active', 'rejected']),
    );
  });

  it('keeps the tab, search and page in the URL', async () => {
    const api = await open('/users?status=active&search=sam');

    expect(await waitForRow('Sam Staff')).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Ana Admin/ })).not.toBeInTheDocument();
    expect(api.lists[0]).toMatchObject({ status: 'active', search: 'sam' });
    expect(screen.getByRole('searchbox', { name: 'Search users' })).toHaveValue('sam');
  });

  it('searches by name, email or Telegram username', async () => {
    const user = userEvent.setup();
    const api = await open();
    await waitForRow('Pat Pending');

    await user.type(screen.getByRole('searchbox', { name: 'Search users' }), 'quinn');

    // The list is reloaded for the search, so Pat leaves and only Quinn is left.
    await waitFor(() => expect(screen.queryByText('Pat Pending')).not.toBeInTheDocument());
    expect(await waitForRow('Quinn Queue')).toBeInTheDocument();
    expect(api.lists.at(-1)).toMatchObject({ search: 'quinn', page: '1' });
  });

  it('lists unfinished signups under the Incomplete profile filter, on the Pending tab only', async () => {
    const user = userEvent.setup();
    const api = await open();
    await waitForRow('Pat Pending');

    await user.click(screen.getByRole('checkbox', { name: 'Incomplete profile' }));

    expect(await waitForRow('Ivy Unfinished')).toBeInTheDocument();
    expect(screen.queryByText('Pat Pending')).not.toBeInTheDocument();
    expect(api.lists.at(-1)).toMatchObject({ status: 'pending', incomplete: 'true' });
    const unfinished = within(rowOf('Ivy Unfinished'));
    expect(unfinished.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(unfinished.getByRole('button', { name: 'Approve' })).toHaveAttribute(
      'title',
      expect.stringMatching(/finish their profile/),
    );
    expect(unfinished.getByText(/finish their profile/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Active/ }));
    await waitForRow('Sam Staff');
    expect(screen.queryByRole('checkbox', { name: 'Incomplete profile' })).not.toBeInTheDocument();
  });

  it('pages through the result', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 45 }, (_, i) =>
      person({ name: `Person ${String(i).padStart(2, '0')}`, status: 'pending' }),
    );
    const api = usersApi(many);
    renderApp({ route: '/users' });
    await waitForRow('Person 00');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(await waitForRow('Person 20')).toBeInTheDocument();
    expect(api.lists.at(-1)).toMatchObject({ page: '2', limit: '20' });
  });

  it('says so when a tab is empty or the search finds no one', async () => {
    const user = userEvent.setup();
    const api = usersApi([{ ...sam }]);
    renderApp({ route: '/users' });
    expect(await screen.findByText('No one is waiting for approval.')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Active/ }));
    await waitForRow('Sam Staff');
    await user.type(screen.getByRole('searchbox', { name: 'Search users' }), 'zzz');

    expect(await screen.findByText('No users match your search.')).toBeInTheDocument();
    expect(api.lists.length).toBeGreaterThan(1);
  });

  it('shows an error when the list cannot be loaded', async () => {
    const api = usersApi(everyone());
    api.failList = true;
    renderApp({ route: '/users' });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('UsersPage actions', () => {
  it('approves a pending user, who leaves the queue, and the badge follows', async () => {
    const user = userEvent.setup();
    const api = await open();
    const nav = await screen.findByRole('link', { name: /Users/ });
    await waitFor(() => expect(nav).toHaveTextContent('2'));

    await user.click(
      within(await waitForRow('Pat Pending')).getByRole('button', { name: 'Approve' }),
    );

    await waitFor(() => expect(screen.queryByText('Pat Pending')).not.toBeInTheDocument());
    expect(api.patches).toEqual([
      { id: 'Pat Pending', field: 'status', body: { status: 'active' } },
    ]);
    await waitFor(() => expect(nav).toHaveTextContent('1'));
  });

  it('hides the badge when no one is waiting', async () => {
    const user = userEvent.setup();
    usersApi([{ ...pat }, { ...ana }]);
    renderApp({ route: '/users' });
    const nav = await screen.findByRole('link', { name: /Users/ });
    await waitFor(() => expect(nav).toHaveTextContent('1'));

    await user.click(
      within(await waitForRow('Pat Pending')).getByRole('button', { name: 'Approve' }),
    );

    await waitFor(() => expect(nav).not.toHaveTextContent('1'));
    expect(nav).toHaveAccessibleName('Users');
  });

  it('rejects with an optional reason, and can be cancelled', async () => {
    const user = userEvent.setup();
    const api = await open();
    await user.click(
      within(await waitForRow('Pat Pending')).getByRole('button', { name: 'Reject' }),
    );

    let dialog = await screen.findByRole('dialog', { name: /Reject Pat Pending/ });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.patches).toEqual([]);

    await user.click(
      within(await waitForRow('Pat Pending')).getByRole('button', { name: 'Reject' }),
    );
    dialog = await screen.findByRole('dialog', { name: /Reject Pat Pending/ });
    await user.type(within(dialog).getByLabelText('Reason (optional)'), 'Not on the team');
    await user.click(within(dialog).getByRole('button', { name: 'Reject user' }));

    await waitFor(() => expect(screen.queryByText('Pat Pending')).not.toBeInTheDocument());
    expect(api.patches).toEqual([
      {
        id: 'Pat Pending',
        field: 'status',
        body: { status: 'rejected', reason: 'Not on the team' },
      },
    ]);
  });

  it('refuses a reason over 500 characters without sending anything', async () => {
    const user = userEvent.setup();
    const api = await open();
    await user.click(
      within(await waitForRow('Pat Pending')).getByRole('button', { name: 'Reject' }),
    );
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByLabelText('Reason (optional)'));
    await user.paste('x'.repeat(501));
    await user.click(within(dialog).getByRole('button', { name: 'Reject user' }));

    expect(
      await within(dialog).findByText('Reason must be at most 500 characters'),
    ).toBeInTheDocument();
    expect(api.patches).toEqual([]);
  });

  it('rejects without a reason', async () => {
    const user = userEvent.setup();
    const api = await open();
    await user.click(
      within(await waitForRow('Quinn Queue')).getByRole('button', { name: 'Reject' }),
    );
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Reject user' }));

    await waitFor(() => expect(api.patches).toHaveLength(1));
    expect(api.patches[0].body).toEqual({ status: 'rejected' });
  });

  it('reactivates a rejected user to Active or to Pending', async () => {
    const user = userEvent.setup();
    const api = await open('/users?status=rejected');
    const row = within(await waitForRow('Rex Rejected'));
    expect(row.getByText('Not on the team')).toBeInTheDocument();

    await user.click(row.getByRole('button', { name: 'Move to pending' }));
    await waitFor(() => expect(screen.queryByText('Rex Rejected')).not.toBeInTheDocument());
    expect(api.patches.at(-1).body).toEqual({ status: 'pending' });

    api.users.find((u) => u.name === 'Rex Rejected').status = 'rejected';
    await user.click(screen.getByRole('tab', { name: /Pending/ }));
    await user.click(screen.getByRole('tab', { name: /Rejected/ }));
    await user.click(
      within(await waitForRow('Rex Rejected')).getByRole('button', { name: 'Reactivate' }),
    );
    await waitFor(() => expect(api.patches.at(-1).body).toEqual({ status: 'active' }));
  });

  it('changes an active user role after a confirmation', async () => {
    const user = userEvent.setup();
    const api = await open('/users?status=active');
    await user.click(
      within(await waitForRow('Sam Staff')).getByRole('button', { name: 'Make admin' }),
    );

    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(api.patches).toEqual([]);

    await user.click(within(rowOf('Sam Staff')).getByRole('button', { name: 'Make admin' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Make admin' }),
    );

    await waitFor(() =>
      expect(api.patches).toEqual([{ id: 'Sam Staff', field: 'role', body: { role: 'admin' } }]),
    );
    expect(
      await within(rowOf('Sam Staff')).findByRole('button', { name: 'Make staff' }),
    ).toBeInTheDocument();
  });

  it('disables rejecting or demoting yourself, and says why', async () => {
    await open('/users?status=active');
    const own = within(await waitForRow('Ana Admin'));

    expect(own.getByRole('button', { name: 'Reject' })).toBeDisabled();
    expect(own.getByRole('button', { name: 'Make staff' })).toBeDisabled();
    expect(own.getByRole('button', { name: 'Reject' })).toHaveAttribute(
      'title',
      'You cannot reject or demote yourself.',
    );
    expect(own.getByText(/cannot reject or demote yourself/i)).toBeInTheDocument();
    expect(within(rowOf('Sam Staff')).getByRole('button', { name: 'Reject' })).toBeEnabled();
  });

  it('shows the server message when another admin acted first, and refreshes the row', async () => {
    const user = userEvent.setup();
    const api = await open();
    await waitForRow('Pat Pending');
    api.failNext = {
      status: 409,
      body: {
        code: 'INVALID_TRANSITION',
        message: 'This change is not allowed, or someone else already made it.',
      },
    };
    const before = api.lists.length;

    await user.click(within(rowOf('Pat Pending')).getByRole('button', { name: 'Approve' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/someone else already made it/);
    await waitFor(() => expect(api.lists.length).toBeGreaterThan(before));
    expect(await waitForRow('Pat Pending')).toBeInTheDocument();
  });
});

const change = (overrides) => ({
  id: `c-${overrides.to}-${overrides.at}`,
  changedBy: 'a1',
  changedByName: 'Ana Admin',
  reason: null,
  ...overrides,
});

describe('UsersPage detail drawer', () => {
  async function openDrawer(name) {
    const user = userEvent.setup();
    await user.click(
      within(await waitForRow(name)).getByRole('button', { name: new RegExp(name) }),
    );
    return { user, drawer: await screen.findByRole('dialog', { name: new RegExp(name) }) };
  }

  it('shows the profile summary of the user', async () => {
    await open('/users?status=rejected');
    const { drawer } = await openDrawer('Rex Rejected');

    const d = within(drawer);
    expect(d.getByText('rex@example.com')).toBeInTheDocument();
    expect(d.getByText('Verified')).toBeInTheDocument();
    expect(d.getByText('rejected')).toBeInTheDocument();
    expect(d.getByText('staff')).toBeInTheDocument();
    expect(d.getByText('Not on the team')).toBeInTheDocument();
    expect(d.getByText('Never')).toBeInTheDocument();
  });

  it('lists the status changes in the order the server sends them, newest first', async () => {
    const api = usersApi(everyone());
    api.history['Rex Rejected'] = [
      change({ from: 'rejected', to: 'active', at: '2026-10-10T10:00:00.000Z' }),
      change({
        from: 'pending',
        to: 'rejected',
        at: '2026-10-01T10:00:00.000Z',
        reason: 'Wrong team',
        changedByName: 'Tom Telegram-Admin',
      }),
      change({
        from: 'pending',
        to: 'active',
        at: '2026-09-01T10:00:00.000Z',
        changedBy: null,
        changedByName: 'System (admin list)',
      }),
    ];
    renderApp({ route: '/users?status=rejected' });
    const { drawer } = await openDrawer('Rex Rejected');

    const items = within(
      await within(drawer).findByRole('list', { name: 'Status history' }),
    ).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Rejected to Active');
    expect(items[0]).toHaveTextContent('Ana Admin');
    expect(items[1]).toHaveTextContent('Pending to Rejected');
    expect(items[1]).toHaveTextContent('Tom Telegram-Admin');
    expect(items[1]).toHaveTextContent('Wrong team');
    expect(items[2]).toHaveTextContent('System (admin list)');
  });

  it('says so when the status never changed', async () => {
    await open();
    const { drawer } = await openDrawer('Pat Pending');

    expect(await within(drawer).findByText('No status changes yet.')).toBeInTheDocument();
  });

  it('links to the movements of the user once Movements ships, and is disabled until then', async () => {
    await open();
    const { drawer } = await openDrawer('Pat Pending');

    const button = within(drawer).getByRole('button', { name: 'View movements' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Available once Movements ships.');
    expect(within(drawer).getByText('Available once Movements ships.')).toBeInTheDocument();
  });

  it('keeps the open user in the URL, opens from a link, and closes', async () => {
    const user = userEvent.setup();
    await open('/users?status=rejected&user=Rex%20Rejected');

    const drawer = await screen.findByRole('dialog', { name: /Rex Rejected/ });
    expect(within(drawer).getByText('rex@example.com')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await waitForRow('Rex Rejected')).toBeInTheDocument();
  });

  it('shows an error when the user cannot be loaded', async () => {
    await open('/users?user=missing');

    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByRole('alert')).toHaveTextContent('User not found.');
  });

  it('does not open from the action buttons', async () => {
    const user = userEvent.setup();
    const api = await open();
    await user.click(
      within(await waitForRow('Pat Pending')).getByRole('button', { name: 'Approve' }),
    );

    await waitFor(() => expect(api.patches).toHaveLength(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
