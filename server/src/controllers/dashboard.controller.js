import * as dashboard from '../services/dashboard.service.js';

export async function get(req, res) {
  res.json(await dashboard.getDashboard(req.user));
}
