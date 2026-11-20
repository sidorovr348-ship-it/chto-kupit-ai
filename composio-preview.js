'use strict';

const crypto = require('node:crypto');

const PREVIEW_BRANCH = 'feat/unified-open-models-video';
const OWNER_USER_ID = 'ey-owner';
const SESSION_CONFIG = {
  toolkits: ['github'],
  manageConnections: true,
  tags: { enabled: ['readOnlyHint'] }
};

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
  const match = /^Bearer ([^\s]+)$/.exec(header);
  return Boolean(expected && match && safeEqual(match[1], expected));
}

function getItems(value) {
  if (Array.isArray(value)) return value;
  for (const candidate of [value?.items, value?.tools, value?.results, value?.data?.items, value?.data?.tools, value?.data?.results]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function normalizeTool(item) {
  const tool = item?.tool && typeof item.tool === 'object' ? item.tool : item || {};
  const schema = tool.inputParameters || tool.input_parameters || tool.inputSchema || tool.input_schema || tool.parameters || {};
  const tags = Array.isArray(tool.tags) ? tool.tags : Object.keys(tool.tags || {}).filter((key) => tool.tags[key]);
  const required = Array.isArray(schema.required) ? schema.required : Array.isArray(schema?.jsonSchema?.required) ? schema.jsonSchema.required : [];
  return {
    slug: String(tool.slug || tool.toolSlug || tool.tool_slug || tool.name || ''),
    name: String(tool.name || tool.displayName || tool.display_name || tool.slug || ''),
    description: String(tool.description || '').slice(0, 500),
    tags,
    readOnly: tags.includes('readOnlyHint') || tool.readOnlyHint === true || tool.read_only_hint === true,
    required
  };
}

function isSafeProfileTool(tool) {
  const identity = (tool.slug + ' ' + tool.name + ' ' + tool.description).toUpperCase();
  return /^GITHUB_[A-Z0-9_]+$/.test(tool.slug) &&
    tool.readOnly &&
    tool.required.length === 0 &&
    /(AUTHENTICATED|CURRENT|PROFILE|VIEWER)/.test(identity) &&
    !/(DELETE|CREATE|UPDATE|WRITE|PUSH|MERGE|COMMENT|EDIT|ADD|REMOVE|CLOSE)/.test(identity);
}

function redact(value, depth = 0) {
  if (depth > 6) return '[truncated]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 4000);
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => redact(item, depth + 1));
  if (typeof value !== 'object') return String(value).slice(0, 500);
  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, 60)) {
    if (/token|secret|authorization|cookie|api.?key|credential/i.test(key)) continue;
    out[key] = redact(item, depth + 1);
  }
  return out;
}

function registerComposioPreviewRoutes(app, options = {}) {
  const loadComposio = options.loadComposio || (() => import('@composio/core'));

  async function createSession() {
    if (!process.env.COMPOSIO_API_KEY) throw Object.assign(new Error('Composio API key is not configured'), { status: 503 });
    const { Composio } = await loadComposio();
    const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
    return composio.sessions.create(OWNER_USER_ID, SESSION_CONFIG);
  }

  function guard(req, res) {
    res.set('Cache-Control', 'no-store');
    if (!isAllowedPreview()) {
      res.status(404).json({ ok: false, error: 'Not found' });
      return false;
    }
    if (!ownerAuthorized(req)) {
      res.status(401).json({ ok: false, error: 'Требуется авторизация владельца' });
      return false;
    }
    return true;
  }

  function reportFailure(label, error, res) {
    console.error(label, JSON.stringify({
      name: String(error?.name || 'Error').slice(0, 80),
      status: Number(error?.status || error?.statusCode || 0) || undefined,
      message: String(error?.message || 'Composio request failed').slice(0, 240)
    }));
    if (!res.headersSent) res.status(error?.status === 503 ? 503 : 502).json({ ok: false, error: 'Не удалось выполнить запрос Composio. Проверь API key и права Session management / Session tool execution.' });
  }

  app.post('/api/composio/github/connect', async (req, res) => {
    if (!guard(req, res)) return;
    let session;
    try {
      session = await createSession();
      const host = String(process.env.VERCEL_URL || '');
      const callbackUrl = /^[a-z0-9.-]+\.vercel\.app$/i.test(host) ? 'https://' + host + '/composio-connect.html' : undefined;
      const connection = await session.authorize('github', callbackUrl ? { callbackUrl } : {});
      const redirectUrl = connection?.redirectUrl || connection?.redirect_url || connection?.url;
      if (typeof redirectUrl !== 'string' || !redirectUrl.startsWith('https://')) {
        console.error('COMPOSIO_GITHUB_CONNECT_INVALID_RESPONSE');
        return res.status(502).json({ ok: false, error: 'Composio не вернул ссылку подключения' });
      }
      return res.status(200).json({ ok: true, toolkit: 'github', redirectUrl });
    } catch (error) {
      reportFailure('COMPOSIO_GITHUB_CONNECT_FAILED', error, res);
    }
  });

  app.get('/api/composio/github/status', async (req, res) => {
    if (!guard(req, res)) return;
    let session;
    try {
      session = await createSession();
      const result = await session.toolkits();
      const github = getItems(result).find((item) => String(item?.slug || '').toLowerCase() === 'github');
      const connection = github?.connection || {};
      return res.json({
        ok: true,
        toolkit: 'github',
        connected: connection.isActive === true,
        status: String(connection.connectedAccount?.status || (connection.isActive ? 'ACTIVE' : 'NOT_CONNECTED')).slice(0, 40)
      });
    } catch (error) {
      reportFailure('COMPOSIO_GITHUB_STATUS_FAILED', error, res);
    } finally {
      if (session?.delete) await session.delete().catch(() => {});
    }
  });

  app.get('/api/composio/github/tools', async (req, res) => {
    if (!guard(req, res)) return;
    let session;
    try {
      session = await createSession();
      const result = await session.search({ query: 'Read the currently authenticated GitHub user profile', toolkits: ['github'] });
      const tools = getItems(result).map(normalizeTool).filter((tool) => tool.slug.startsWith('GITHUB_'));
      return res.json({ ok: true, toolkit: 'github', tools: tools.slice(0, 20).map((tool) => ({ slug: tool.slug, name: tool.name, description: tool.description, readOnly: tool.readOnly, required: tool.required })) });
    } catch (error) {
      reportFailure('COMPOSIO_GITHUB_TOOLS_FAILED', error, res);
    } finally {
      if (session?.delete) await session.delete().catch(() => {});
    }
  });

  app.post('/api/composio/github/smoke', async (req, res) => {
    if (!guard(req, res)) return;
    let session;
    try {
      session = await createSession();
      const states = await session.toolkits();
      const github = getItems(states).find((item) => String(item?.slug || '').toLowerCase() === 'github');
      if (github?.connection?.isActive !== true) {
        return res.status(409).json({ ok: false, error: 'GitHub ещё не подключён. Сначала заверши OAuth и проверь статус.' });
      }
      const searchResult = await session.search({ query: 'Read the currently authenticated GitHub user profile', toolkits: ['github'] });
      const candidate = getItems(searchResult).map(normalizeTool).find(isSafeProfileTool);
      if (!candidate) {
        return res.status(409).json({ ok: false, error: 'Не найден гарантированно безопасный read-only инструмент профиля. Ничего не выполнялось.' });
      }
      const result = await session.execute(candidate.slug, {});
      if (result?.resultType === 'blocked') {
        return res.status(409).json({ ok: false, error: 'Composio заблокировал выполнение политикой сессии.', tool: candidate.slug });
      }
      return res.json({ ok: true, executed: true, toolkit: 'github', tool: candidate.slug, result: redact(result) });
    } catch (error) {
      reportFailure('COMPOSIO_GITHUB_SMOKE_FAILED', error, res);
    } finally {
      if (session?.delete) await session.delete().catch(() => {});
    }
  });
}

module.exports = registerComposioPreviewRoutes;
