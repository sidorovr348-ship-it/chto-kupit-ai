const crypto = require('crypto');

const BASE_URL = String(process.env.CLOUDRU_AGENT_URL || '').trim().replace(/\/$/, '');
const TOKEN = String(process.env.CLOUDRU_AGENT_TOKEN || '').trim();
const TIMEOUT_MS = Number(process.env.CLOUDRU_AGENT_TIMEOUT_MS || 45000);

function configured() {
  return Boolean(BASE_URL);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function headers() {
  const h = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

function textFromA2A(data) {
  const out = [];
  const walk = (value) => {
    if (!value) return;
    if (typeof value === 'string') return;
    if (Array.isArray(value)) return value.forEach(walk);
    if (typeof value !== 'object') return;
    if (typeof value.text === 'string' && value.text.trim()) out.push(value.text.trim());
    for (const key of ['message', 'result', 'artifact', 'artifacts', 'parts', 'content', 'status', 'history']) {
      if (value[key]) walk(value[key]);
    }
  };
  walk(data?.result ?? data);
  return [...new Set(out)].join('\n').trim();
}

async function getAgentCard() {
  if (!configured()) throw Object.assign(new Error('CLOUDRU_AGENT_URL is not configured'), { status: 503 });
  const candidates = [
    `${BASE_URL}/.well-known/agent-card.json`,
    `${BASE_URL}/.well-known/agent.json`
  ];
  let lastError = null;
  for (const url of candidates) {
    try {
      const response = await fetchWithTimeout(url, { headers: headers() }, 10000);
      const text = await response.text();
      if (response.ok) return text ? JSON.parse(text) : {};
      lastError = new Error(`Cloud.ru Agent Card HTTP ${response.status}`);
    } catch (error) { lastError = error; }
  }
  throw Object.assign(lastError || new Error('Cloud.ru Agent Card unavailable'), { status: 502 });
}

async function sendMessage(prompt, options = {}) {
  if (!configured()) throw Object.assign(new Error('Cloud.ru agent is not configured'), { status: 503 });
  const message = {
    messageId: crypto.randomUUID(),
    role: 'user',
    parts: [{ kind: 'text', text: String(prompt || '').trim() }]
  };
  if (!message.parts[0].text) throw Object.assign(new Error('prompt is required'), { status: 400 });

  const endpoint = String(options.endpoint || BASE_URL).replace(/\/$/, '');
  const payload = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'message/send',
    params: { message }
  };
  if (options.contextId) payload.params.contextId = options.contextId;

  const response = await fetchWithTimeout(endpoint, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw Object.assign(new Error(`Cloud.ru agent request failed (${response.status})`), { status: response.status, details: data });
  if (data.error) throw Object.assign(new Error(data.error.message || 'Cloud.ru agent returned an error'), { status: 502, details: data.error });
  const result = textFromA2A(data);
  return { result, raw: data };
}

async function ask(prompt, options = {}) {
  const card = await getAgentCard();
  const endpoint = card.url || card.urlAgent || card.endpoints?.[0]?.url || BASE_URL;
  return sendMessage(prompt, { ...options, endpoint });
}

module.exports = { configured, getAgentCard, sendMessage, ask };
