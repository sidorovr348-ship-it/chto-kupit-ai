const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data', 'supervisor');
const INCIDENTS = path.join(DATA, 'incidents.jsonl');
const STATE = path.join(DATA, 'state.json');
fs.mkdirSync(DATA, { recursive: true });
function log(type, details = {}) { fs.appendFileSync(INCIDENTS, JSON.stringify({ ts: new Date().toISOString(), type, ...details }) + '\n'); }
function readState() { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { repairs: 0 }; } }
function writeState(s) { fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); }
async function checkUrl(url, timeoutMs = 8000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { const r = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'My-AI-Unified-Supervisor/1.0' } }); return { ok: r.ok, status: r.status }; }
  catch (e) { return { ok: false, error: e.message }; } finally { clearTimeout(timer); }
}
async function diagnostics() {
  const checks = {};
  checks.node = process.version;
  checks.mainApi = await checkUrl(`http://127.0.0.1:${process.env.PORT || 3020}/health`);
  checks.internet = await checkUrl('https://www.google.com/generate_204', 6000);
  checks.serper = Boolean(process.env.SERPER_API_KEY);
  checks.paralon = Boolean(process.env.PARALON_API_KEY);
  try { execFileSync('npm', ['test'], { cwd: ROOT, stdio: 'pipe', timeout: 30000 }); checks.tests = { ok: true }; }
  catch (e) { checks.tests = { ok: false, error: String(e.stderr || e.message).slice(0, 1000) }; }
  return { ok: Boolean(checks.mainApi.ok && checks.internet.ok && checks.tests.ok), checks, ts: new Date().toISOString() };
}
function localOnly(req) { const ip = String(req.socket?.remoteAddress || ''); return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'; }
function attach(app) {
  app.get('/supervisor/status', (req, res) => { if (!localOnly(req)) return res.status(404).end(); res.json({ ok: true, service: 'my-ai-unified', autonomous: true, internet: true, selfDiagnostics: true, guardedSelfRepair: true, rollback: 'backup-only', learningLog: INCIDENTS }); });
  app.get('/supervisor/diagnostics', async (req, res) => { if (!localOnly(req)) return res.status(404).end(); try { const result = await diagnostics(); log('diagnostic', result); res.json(result); } catch (e) { res.status(500).json({ ok: false, error: e.message }); } });
  app.post('/supervisor/repair', async (req, res) => { if (!localOnly(req)) return res.status(404).end(); try { const result = await diagnostics(); log('diagnostic_before_repair', result); if (result.ok) return res.json({ ok: true, action: 'none', diagnostics: result }); const state = readState(); state.repairs = Number(state.repairs || 0) + 1; writeState(state); log('repair_requested', { repairs: state.repairs }); res.json({ ok: false, action: 'watchdog_restart', message: 'Диагностика обнаружила проблему. Watchdog автоматически перезапустит сервис, если health-check не восстановится.', diagnostics: result }); } catch (e) { log('repair_error', { error: e.message }); res.status(500).json({ ok: false, error: e.message }); } });
  log('supervisor_started', { pid: process.pid });
}
module.exports = { attach, diagnostics, log };
