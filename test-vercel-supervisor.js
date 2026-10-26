const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('supervisor imports in Vercel mode without writing into the deployment tree', () => {
  const result = spawnSync(process.execPath, ['-e', "process.env.VERCEL = '1'; require('./supervisor');"], {
    cwd: path.join(__dirname),
    env: { ...process.env, VERCEL: '1', HF_FREE_AGENT_BOOTSTRAP_DISABLED: '' },
    encoding: 'utf8',
    timeout: 10000
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `exit=${result.status}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
});
