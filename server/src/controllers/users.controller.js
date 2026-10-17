import * as userStatus from '../services/userStatus.service.js';
import * as usersService from '../services/users.service.js';
import { toAdminUser } from '../utils/adminUser.js';

export async function list(req, res) {
  const { users, total, page, limit } = await usersService.listUsers(req.validatedQuery);
  res.json({ items: users.map(toAdminUser), total, page, limit });
}

export async function pendingCount(_req, res) {
  res.json({ count: await usersService.pendingCount() });
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
