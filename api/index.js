// Vercel Function: every /api/* request is rewritten here (see vercel.json) and handled by the
// Express app. req.url keeps the original path, so the app's /api routes match unchanged.
import { getApp } from '../server/src/serverless.js';

export default async function handler(req, res) {
  let app;
  try {
    app = await getApp();
  } catch (err) {
    console.error('Failed to start the API:', err.message);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ message: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' }));
    return;
  }
  return app(req, res);
}
