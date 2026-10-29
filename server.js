// Local development server. On Netlify, public/ is served as static files and
// /api/* runs as the function in netlify/functions/api.mjs. This mirrors that setup.
import 'dotenv/config';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { handleApi } from './src/api.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4242);
const app = express();

// Hand /api/* to the same handler Netlify uses, translating to a Web Request and back.
app.use('/api', express.raw({ type: '*/*', limit: '100kb' }), async (req, res) => {
  const hasBody = !['GET', 'HEAD'].includes(req.method) && Buffer.isBuffer(req.body);
  const request = new Request(`http://${req.headers.host}${req.originalUrl}`, {
    method: req.method,
    headers: req.headers,
    body: hasBody ? req.body : undefined,
  });
  const response = await handleApi(request);
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (response.body) Readable.fromWeb(response.body).pipe(res);
  else res.end();
});

app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`👑 Gooolala is running at http://localhost:${PORT}`);
  if (!process.env.STRIPE_SECRET_KEY) console.log('   Preview mode: set STRIPE_SECRET_KEY in .env to take real orders.');
  if (!process.env.SMTP_HOST) console.log('   Emails are saved to email-previews/ until SMTP_* is set in .env.');
});
