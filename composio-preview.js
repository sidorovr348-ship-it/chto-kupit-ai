'use strict';

const crypto = require('node:crypto');

const PREVIEW_BRANCH = 'feat/unified-open-models-video';
const OWNER_USER_ID = 'ey-owner';

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isAllowedPreview() {
  return process.env.VERCEL_ENV === 'preview' &&
    process.env.VERCEL_GIT_COMMIT_REF === PREVIEW_BRANCH;
}

function ownerAuthorized(req) {
  const expected = process.env.COMPOSIO_OWNER_TOKEN;
  const header = req.get('authorization') || '';
  const match = /^Bearer ([^\\s]+)$/.exec(header);
  return Boolean(expected && match && safeEqual(match[1], expected));
}

// Load the ESM-only SDK lazily. A top-level require() crashes the entire
// serverless function before unrelated routes (including /health) can run.
module.exports = function registerComposioPreviewRoutes(app, options = {}) {
  const loadComposio = options.loadComposio || (() => import('@composio/core'));

  app.post('/api/composio/github/connect', async (req, res) => {
    res.set('Cache-Control', 'no-store');

    if (!isAllowedPreview()) {
      return res.status(404).json({ ok: false, error: 'Not found' });
    }

    if (!ownerAuthorized(req)) {
      return res.status(401).json({ ok: false, error: 'Требуется авторизация владельца' });
    }

    if (!process.env.COMPOSIO_API_KEY) {
      return res.status(503).json({ ok: false, error: 'Composio API key не настроен в Preview' });
    }

    try {
      const { Composio } = await loadComposio();
      const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
      const session = await composio.sessions.create(OWNER_USER_ID);
      const connection = await session.authorize('github');
      const redirectUrl = connection?.redirectUrl || connection?.redirect_url || connection?.url;

      if (typeof redirectUrl !== 'string' || !/^https:\\/\\//i.test(redirectUrl)) {
        console.error('COMPOSIO_GITHUB_CONNECT_INVALID_RESPONSE');
        return res.status(502).json({ ok: false, error: 'Composio не вернул ссылку подключения' });
      }

      return res.status(200).json({ ok: true, toolkit: 'github', redirectUrl });
    } catch (error) {
      console.error('COMPOSIO_GITHUB_CONNECT_FAILED', JSON.stringify({
        name: String(error?.name || 'Error').slice(0, 80),
        status: Number(error?.status || error?.statusCode || 0) || undefined,
        message: String(error?.message || 'Composio request failed').slice(0, 240)
      }));
      return res.status(502).json({ ok: false, error: 'Не удалось создать ссылку подключения GitHub' });
    }
  });
};
