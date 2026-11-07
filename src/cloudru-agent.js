const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data', 'supervisor');
const INCIDENTS = path.join(DATA, 'incidents.jsonl');
const STATE = path.join(DATA, 'state.json');
fs.mkdirSync(DATA, { recursive: true });
function log(type, details = {}) { fs.appendFileSync(INCIDENTS, JSON.stringify({ ts: new Date().toISOString(), type, ...details }) + '\n'); }
function readState() { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { repairs: 0 }; } }
function writeState(s) { fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); }
async function checkUrl(url, timeoutMs = 8000) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); try { const r = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'My-AI-Unified-Supervisor/1.0' } }); return { ok: r.ok, status: r.status }; } catch (e) { return { ok: false, error: e.message }; } finally { clearTimeout(timer); } }
async function diagnostics() { const checks = {}; checks.node = process.version; checks.mainApi = await checkUrl(`http://127.0.0.1:${process.env.PORT || 3020}/health`); checks.internet = await checkUrl('https://www.google.com/generate_204', 6000); checks.serper = Boolean(process.env.SERPER_API_KEY); checks.paralon = Boolean(process.env.PARALON_API_KEY); checks.huggingface = Boolean(process.env.HF_TOKEN); checks.cloudru = Boolean(process.env.CLOUDRU_AGENT_URL); try { execFileSync('npm', ['test'], { cwd: ROOT, stdio: 'pipe', timeout: 30000 }); checks.tests = { ok: true }; } catch (e) { checks.tests = { ok: false, error: String(e.stderr || e.message).slice(0, 1000) }; } return { ok: Boolean(checks.mainApi.ok && checks.internet.ok && checks.tests.ok), checks, ts: new Date().toISOString() }; }
function localOnly(req) { const ip = String(req.socket?.remoteAddress || ''); return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'; }
function attach(app) { app.get('/supervisor/status', (req, res) => { if (!localOnly(req)) return res.status(404).end(); res.json({ ok: true, service: 'my-ai-unified', autonomous: true, internet: true, selfDiagnostics: true, guardedSelfRepair: true, rollback: 'backup-only', learningLog: INCIDENTS }); }); app.get('/supervisor/diagnostics', async (req, res) => { if (!localOnly(req)) return res.status(404).end(); try { const result = await diagnostics(); log('diagnostic', result); res.json(result); } catch (e) { res.status(500).json({ ok: false, error: e.message }); } }); app.post('/supervisor/repair', async (req, res) => { if (!localOnly(req)) return res.status(404).end(); try { const result = await diagnostics(); log('diagnostic_before_repair', result); if (result.ok) return res.json({ ok: true, action: 'none', diagnostics: result }); const state = readState(); state.repairs = Number(state.repairs || 0) + 1; writeState(state); log('repair_requested', { repairs: state.repairs }); res.json({ ok: false, action: 'watchdog_restart', message: 'Диагностика обнаружила проблему. Watchdog автоматически перезапустит сервис, если health-check не восстановится.', diagnostics: result }); } catch (e) { log('repair_error', { error: e.message }); res.status(500).json({ ok: false, error: e.message }); } }); log('supervisor_started', { pid: process.pid }); }

const HF_ROUTER_URL = String(process.env.HF_ROUTER_URL || 'https://router.huggingface.co/v1/chat/completions').trim();
const HF_FREE_MODEL = String(process.env.HF_FREE_MODEL || 'google/gemma-2-2b-it:cheapest').trim();
const HF_TIMEOUT_MS = Number(process.env.HF_TIMEOUT_MS || 45000);
function hfConfigured() { return Boolean(String(process.env.HF_TOKEN || '').trim()); }
async function hfFreeCall(messages) {
  if (!hfConfigured()) throw Object.assign(new Error('HF_TOKEN is not configured'), { code: 'HF_NOT_CONFIGURED', status: 503 });
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);
  try {
    const response = await fetch(HF_ROUTER_URL, { method: 'POST', headers: { Authorization: `Bearer ${String(process.env.HF_TOKEN).trim()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: HF_FREE_MODEL, messages, max_tokens: Number(process.env.HF_MAX_TOKENS || 1200), temperature: 0.3 }), signal: controller.signal });
    const text = await response.text(); let data = {}; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) throw Object.assign(new Error(`Hugging Face request failed (${response.status})`), { code: 'HF_REQUEST_FAILED', status: response.status, details: data });
    const answer = data.choices?.[0]?.message?.content;
    if (!answer || !String(answer).trim()) throw Object.assign(new Error('Hugging Face returned an empty answer'), { code: 'HF_EMPTY', status: 502, details: data });
    return String(answer).trim();
  } catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error('Hugging Face не ответил вовремя'), { code: 'HF_TIMEOUT', status: 504 });
    throw error;
  } finally { clearTimeout(timer); }
}

function bootstrapFreeAgentServer() {
  if (process.env.HF_FREE_AGENT_BOOTSTRAP_DISABLED === '1') return;
  const serverPath = path.join(ROOT, 'server.js');
  try {
    let source = fs.readFileSync(serverPath, 'utf8');
    if (source.includes('HF_FREE_AGENT_BOOTSTRAP')) return;
    const importAnchor = "const { diagnostics } = require('./supervisor');";
    if (!source.includes(importAnchor)) throw new Error('server import anchor not found');
    source = source.replace(importAnchor, "const { diagnostics, hfConfigured, hfFreeCall, hfModel } = require('./supervisor');");
    const callAnchor = "async function callParalon(messages) {\n  const safeMessages = withSystemPrompt(messages);";
    if (!source.includes(callAnchor)) throw new Error('callParalon anchor not found');
    source = source.replace(callAnchor, `${callAnchor}\n  // HF_FREE_AGENT_BOOTSTRAP\n  const textOnly = Array.isArray(safeMessages) && safeMessages.every(m => typeof m?.content === 'string');\n  if (textOnly && hfConfigured()) {\n    try { return await hfFreeCall(safeMessages); } catch (error) {\n      if (String(process.env.HF_FREE_ONLY || 'true').toLowerCase() !== 'false') throw error;\n      console.warn('HF free agent unavailable; falling back to Paralon:', error.message);\n    }\n  }`);
    const healthAnchor = "app.get('/health', (req, res) => {";
    if (!source.includes(healthAnchor)) throw new Error('health anchor not found');
    source = source.replace(healthAnchor, `app.get('/hf/health', (req, res) => {\n  res.set('Cache-Control', 'no-store');\n  res.json({ ok: true, configured: hfConfigured(), free_only: String(process.env.HF_FREE_ONLY || 'true').toLowerCase() !== 'false', model: hfModel });\n});\n\n${healthAnchor}`);
    fs.writeFileSync(serverPath, source);
    log('hf_free_agent_bootstrap', { model: HF_FREE_MODEL });
  } catch (error) {
    log('hf_free_agent_bootstrap_error', { error: error.message });
  }
}
bootstrapFreeAgentServer();

const CLOUDRU_AGENT_URL = String(process.env.CLOUDRU_AGENT_URL || '').trim().replace(/\/$/, '');
const CLOUDRU_AGENT_TOKEN = String(process.env.CLOUDRU_AGENT_TOKEN || '').trim();
const CLOUDRU_TIMEOUT_MS = Number(process.env.CLOUDRU_AGENT_TIMEOUT_MS || 45000);
function cloudruConfigured() { return Boolean(CLOUDRU_AGENT_URL); }
async function cloudruFetch(url, options = {}, timeoutMs = CLOUDRU_TIMEOUT_MS) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); try { return await fetch(url, { ...options, signal: controller.signal }); } finally { clearTimeout(timer); } }
function cloudruHeaders() { const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }; if (CLOUDRU_AGENT_TOKEN) headers.Authorization = `Bearer ${CLOUDRU_AGENT_TOKEN}`; return headers; }
async function cloudruGetAgentCard() { if (!cloudruConfigured()) throw Object.assign(new Error('CLOUDRU_AGENT_URL is not configured'), { status: 503 }); const candidates = [`${CLOUDRU_AGENT_URL}/.well-known/agent-card.json`, `${CLOUDRU_AGENT_URL}/.well-known/agent.json`]; let lastError = null; for (const url of candidates) { try { const response = await cloudruFetch(url, { headers: cloudruHeaders() }, 10000); const text = await response.text(); if (response.ok) return text ? JSON.parse(text) : {}; lastError = new Error(`Cloud.ru Agent Card HTTP ${response.status}`); } catch (error) { lastError = error; } } throw Object.assign(lastError || new Error('Cloud.ru Agent Card unavailable'), { status: 502 }); }
function cloudruText(data) { const out = []; const walk = value => { if (!value) return; if (typeof value === 'string') return; if (Array.isArray(value)) return value.forEach(walk); if (typeof value !== 'object') return; if (typeof value.text === 'string' && value.text.trim()) out.push(value.text.trim()); for (const key of ['message', 'result', 'artifact', 'artifacts', 'parts', 'content', 'status', 'history']) if (value[key]) walk(value[key]); }; walk(data?.result ?? data); return [...new Set(out)].join('\n').trim(); }
async function cloudruSendMessage(prompt, options = {}) { if (!cloudruConfigured()) throw Object.assign(new Error('Cloud.ru agent is not configured'), { status: 503 }); const text = String(prompt || '').trim(); if (!text) throw Object.assign(new Error('prompt is required'), { status: 400 }); const message = { messageId: crypto.randomUUID(), role: 'user', parts: [{ kind: 'text', text }] }; const payload = { jsonrpc: '2.0', id: crypto.randomUUID(), method: 'message/send', params: { message } }; if (options.contextId) payload.params.contextId = options.contextId; const response = await cloudruFetch(options.endpoint || CLOUDRU_AGENT_URL, { method: 'POST', headers: cloudruHeaders(), body: JSON.stringify(payload) }); const rawText = await response.text(); let data = {}; try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = { raw: rawText }; } if (!response.ok) throw Object.assign(new Error(`Cloud.ru agent request failed (${response.status})`), { status: response.status, details: data }); if (data.error) throw Object.assign(new Error(data.error.message || 'Cloud.ru agent returned an error'), { status: 502, details: data.error }); return { result: cloudruText(data), raw: data }; }
async function cloudruAsk(prompt, options = {}) { const card = await cloudruGetAgentCard(); const endpoint = card.url || card.urlAgent || card.endpoints?.[0]?.url || CLOUDRU_AGENT_URL; return cloudruSendMessage(prompt, { ...options, endpoint }); }
module.exports = { attach, diagnostics, log, hfConfigured, hfFreeCall, hfModel: HF_FREE_MODEL, cloudruConfigured, cloudruGetAgentCard, cloudruSendMessage, cloudruAsk, configured: cloudruConfigured, getAgentCard: cloudruGetAgentCard, sendMessage: cloudruSendMessage, ask: cloudruAsk };
