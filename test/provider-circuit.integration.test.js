'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('a timed-out model does not block the next model on the same provider', { timeout: 15000 }, async t => {
  const port = 36000 + (process.pid % 1000);
  const preload = path.join(__dirname, 'mock-provider-fetch.cjs');
  const nodeOptions = [process.env.NODE_OPTIONS || '', '--require=' + preload].filter(Boolean).join(' ');
  const child = spawn(process.execPath, ['local-gateway.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      NODE_OPTIONS: nodeOptions,
      MOCK_FIRST_PROVIDER_TIMEOUT: '1',
      GROQ_API_KEY: 'mock-provider-key',
      OPENAI_API_KEY: '',
      DEEPSEEK_API_KEY: '',
      MISTRAL_API_KEY: '',
      PARALON_API_KEY: '',
      ZVENOAI_API_KEY: '',
      HF_TOKEN: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });

  const waitFor = async (predicate, label, timeoutMs = 5000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (predicate()) return;
      if (child.exitCode !== null) throw new Error('gateway exited while waiting for ' + label + '\\n' + output.slice(-4000));
      await sleep(20);
    }
    throw new Error('timed out waiting for ' + label + '\\n' + output.slice(-4000));
  };

  t.after(async () => {
    if (child.exitCode === null) child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      sleep(2000)
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  });

  await waitFor(() => output.includes('My AI Unified core listening on ' + port), 'gateway startup');
  const response = await fetch('http://127.0.0.1:' + port + '/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-request-id': 'model-timeout-fallback-test' },
    body: JSON.stringify({ prompt: 'Кратко объясни, почему небо голубое.' })
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.result, 'MOCK_PROVIDER_RETURNED_2');
  assert.match(output, /AI_PROVIDER_FAIL.*qwen\/qwen3\.8-27b/);
  assert.match(output, /MOCK_PROVIDER_STARTED:2/);
  assert.doesNotMatch(output, /Provider circuit open/);
});
