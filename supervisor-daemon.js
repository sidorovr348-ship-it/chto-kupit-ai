const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const LOG = path.join(ROOT, 'data', 'supervisor', 'daemon.log');
fs.mkdirSync(path.dirname(LOG), { recursive: true });
function log(s) { fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${s}\n`); }
async function get(url, timeout=8000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), timeout);
  try { const r = await fetch(url, { signal:c.signal }); return {ok:r.ok,status:r.status}; }
  catch(e) { return {ok:false,error:e.message}; } finally { clearTimeout(t); }
}
async function check() {
  const port = process.env.MY_AI_PORT || '3020';
  const health = await get(`http://127.0.0.1:${port}/health`);
  if (health.ok) return true;
  log(`Health failed: ${JSON.stringify(health)}; restarting service`);
  try { execFileSync('systemctl',['restart','my-ai-unified.service'],{stdio:'ignore',timeout:30000}); return true; }
  catch(e) { log(`Restart failed: ${e.message}`); return false; }
}
async function main() {
  log('watchdog started');
  await check();
  setInterval(check, 60000);
}
main().catch(e => { log(`fatal: ${e.message}`); process.exit(1); });
