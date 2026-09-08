const fs = require('fs');
const path = require('path');
const { execFile, execFileSync } = require('child_process');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data', 'supervisor');
const INCIDENTS = path.join(DATA, 'incidents.jsonl');
const STATE = path.join(DATA, 'state.json');
fs.mkdirSync(DATA, { recursive: true });

const SAFE_COMMANDS = new Set(['npm', 'node', 'git']);
const BLOCKED = /(rm\s+-rf|mkfs|dd\s+if=|shutdown|reboot|iptables|ufw|systemctl\s+(disable|mask)|curl\s+.*\|\s*(sh|bash))/i;

function log(type, details = {}) {
  fs.appendFileSync(INCIDENTS, JSON.stringify({ ts: new Date().toISOString(), type, ...details }) + '\n');
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { lastGoodCommit: null, repairs: 0 }; }
}
function writeState(s) { fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); }

async function checkUrl(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'My-AI-Unified-Supervisor/1.0' } });
    return { ok: r.ok, status: r.status };
  } catch (e) { return { ok: false, error: e.message }; }
  finally { clearTimeout(timer); }
}

async function diagnostics() {
  const checks = {};
  checks.node = process.version;
  checks.mainApi = await checkUrl(`http://127.0.0.1:${process.env.PORT || 3020}/health`);
  checks.internet = await checkUrl('https://www.google.com/generate_204', 6000);
  checks.serper = Boolean(process.env.SERPER_API_KEY);
  checks.paralon = Boolean(process.env.PARALON_API_KEY);
  try {
    execFileSync('npm', ['test'], { cwd: ROOT, stdio: 'pipe', timeout: 30000 });
    checks.tests = { ok: true };
  } catch (e) {
    checks.tests = { ok: false, error: String(e.stderr || e.message).slice(0, 1000) };
  }
  const healthy = checks.mainApi.ok && checks.internet.ok && checks.tests.ok;
  return { ok: healthy, checks, ts: new Date().toISOString() };
}

function safeExec(command, args = [], options = {}) {
  if (!SAFE_COMMANDS.has(command) || BLOCKED.test([command, ...args].join(' '))) throw new Error('Команда заблокирована политикой безопасности');
  return execFileSync(command, args, { cwd: ROOT, stdio: 'pipe', timeout: options.timeout || 30000, encoding: 'utf8' });
}

function recordGoodCommit() {
  try {
    const commit = safeExec('git', ['rev-parse', 'HEAD']).trim();
    const state = readState();
    state.lastGoodCommit = commit;
    writeState(state);
    return commit;
  } catch { return null; }
}

function rollbackToLastGood() {
  const state = readState();
  if (!state.lastGoodCommit) throw new Error('Нет сохранённой рабочей точки для отката');
  safeExec('git', ['reset', '--hard', state.lastGoodCommit]);
  state.repairs = Number(state.repairs || 0) + 1;
  writeState(state);
  log('rollback', { commit: state.lastGoodCommit });
  return state.lastGoodCommit;
}

function attach(app) {
  app.get('/supervisor/diagnostics', async (req, res) => {
    try { res.json(await diagnostics()); } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/supervisor/status', (req, res) => {
    res.json({ ok: true, service: 'my-ai-unified', autonomous: true, internet: true, selfDiagnostics: true, selfRepair: true, rollback: true, learningLog: INCIDENTS });
  });

  app.post('/supervisor/repair', async (req, res) => {
    try {
      const before = await diagnostics();
      log('diagnostic', before);
      if (before.ok) return res.json({ ok: true, action: 'none', message: 'Ошибок, требующих исправления, не обнаружено.', diagnostics: before });
      recordGoodCommit();
      if (!before.checks.tests.ok) {
        const commit = rollbackToLastGood();
        return res.json({ ok: true, action: 'rollback', commit, diagnostics: before });
      }
      return res.json({ ok: false, action: 'manual_review', message: 'Автоматическое изменение кода не выполнено: причина не входит в безопасный набор самовосстановления.', diagnostics: before });
    } catch (e) {
      log('repair_error', { error: e.message });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  recordGoodCommit();
  log('supervisor_started', { pid: process.pid });
}

module.exports = { attach, diagnostics, log };
