import * as userStatus from '../services/userStatus.service.js';
import * as usersService from '../services/users.service.js';
import { isDemoUser } from '../middleware/denyDemo.js';
import { toAdminUser, toStatusChange } from '../utils/adminUser.js';

/** The demo account (DEMO_EMAILS) sees emails and Telegram usernames masked. */
const viewFor = (req) => {
  const demo = isDemoUser(req.user, req.app.locals.config);
  return { hideContact: demo, searchContact: !demo };
};

export async function list(req, res) {
  const view = viewFor(req);
  const { users, total, page, limit } = await usersService.listUsers(req.validatedQuery, view);
  res.json({ items: users.map((user) => toAdminUser(user, view)), total, page, limit });
}

export async function pendingCount(_req, res) {
  res.json({ count: await usersService.pendingCount() });
}

export async function detail(req, res) {
  const { user, history } = await usersService.getUserWithHistory(req.params.id);
  res.json({ user: toAdminUser(user, viewFor(req)), history: history.map(toStatusChange) });
}

export async function changeStatus(req, res) {
  const { config, mailer, telegram } = req.app.locals;
  const user = await userStatus.changeStatus(
    { actor: req.user, userId: req.params.id, to: req.body.status, reason: req.body.reason },
    { config, mailer, telegram },
  );
  res.json({ user: toAdminUser(user) });
}

export async function changeRole(req, res) {
  const user = await userStatus.changeRole({
    actor: req.user,
    userId: req.params.id,
    role: req.body.role,
  });
  res.json({ user: toAdminUser(user) });
}
