const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const serverPath = path.join(root, 'server.js');
const OPENROUTER_FREE_MODEL = String(process.env.OPENROUTER_FREE_MODEL || 'openrouter/free').trim();
let source = fs.readFileSync(serverPath, 'utf8');

if (source.includes('OPENROUTER_FREE_BOOTSTRAP')) {
  console.log('OpenRouter free bootstrap already present');
  process.exit(0);
}

const importAnchor = "const { diagnostics } = require('./supervisor');";
if (!source.includes(importAnchor)) throw new Error('server import anchor not found');

source = source.replace(importAnchor, "const { diagnostics } = require('./supervisor');\n\n// OPENROUTER_FREE_BOOTSTRAP\nconst OPENROUTER_BASE_URL = String(process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\\/$/, '');\nconst OPENROUTER_FREE_MODEL = String(process.env.OPENROUTER_FREE_MODEL || 'openrouter/free').trim();\nconst OPENROUTER_FREE_ONLY = String(process.env.OPENROUTER_FREE_ONLY || 'true').toLowerCase() !== 'false';\nconst OPENROUTER_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS || 60000);\nfunction openRouterConfigured() { return Boolean(String(process.env.OPENROUTER_API_KEY || '').trim()); }\nasync function openRouterFreeCall(messages) {\n  if (!openRouterConfigured()) throw Object.assign(new Error('OPENROUTER_API_KEY is not configured'), { status: 503, code: 'OPENROUTER_NOT_CONFIGURED' });\n  const controller = new AbortController();\n  const timer = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);\n  try {\n    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {\n      method: 'POST',\n      headers: {\n        Authorization: `Bearer ${String(process.env.OPENROUTER_API_KEY).trim()}`,\n        'Content-Type': 'application/json',\n        'HTTP-Referer': 'https://chto-kupit-ai.vercel.app',\n        'X-Title': 'My AI Unified'\n      },\n      body: JSON.stringify({ model: OPENROUTER_FREE_MODEL, messages, max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS || 1600), temperature: 0.3 }),\n      signal: controller.signal\n    });\n    const text = await response.text();\n    let data = {};\n    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }\n    if (!response.ok) throw Object.assign(new Error(`OpenRouter request failed (${response.status})`), { status: response.status, details: data });\n    const answer = data.choices?.[0]?.message?.content;\n    if (!answer || !String(answer).trim()) throw Object.assign(new Error('OpenRouter returned an empty answer'), { status: 502, details: data });\n    return String(answer).trim();\n  } catch (error) {\n    if (error.name === 'AbortError') throw Object.assign(new Error('OpenRouter не ответил вовремя'), { status: 504 });\n    throw error;\n  } finally { clearTimeout(timer); }\n}\n");

const callAnchor = "async function callParalon(messages) {\n  const safeMessages = withSystemPrompt(messages);";
if (!source.includes(callAnchor)) throw new Error('callParalon anchor not found');

source = source.replace(callAnchor, `${callAnchor}\n  if (openRouterConfigured()) {\n    try { return await openRouterFreeCall(safeMessages); }\n    catch (error) {\n      if (OPENROUTER_FREE_ONLY) throw error;\n      console.warn('OpenRouter free AI unavailable; paid fallback is explicitly enabled:', error.message);\n    }\n  }\n  if (!String(process.env.ALLOW_PAID_AI || 'false').toLowerCase().includes('true')) {\n    throw Object.assign(new Error('Бесплатный AI не настроен. Укажите OPENROUTER_API_KEY; платный AI отключён.'), { status: 503, code: 'FREE_AI_NOT_CONFIGURED' });\n  }`);

const healthAnchor = "app.get('/health', (req, res) => {";
if (!source.includes(healthAnchor)) throw new Error('health anchor not found');
source = source.replace(healthAnchor, `app.get('/openrouter/health', (req, res) => {\n  res.set('Cache-Control', 'no-store');\n  res.json({ ok: true, configured: openRouterConfigured(), free_only: OPENROUTER_FREE_ONLY, paid_ai_allowed: String(process.env.ALLOW_PAID_AI || 'false').toLowerCase().includes('true'), model: OPENROUTER_FREE_MODEL, daily_limit_note: 'OpenRouter free plan: up to 50 requests/day without credits' });\n});\n\n${healthAnchor}`);

fs.writeFileSync(serverPath, source);
console.log(`OpenRouter free bootstrap applied: ${OPENROUTER_FREE_MODEL}`);
