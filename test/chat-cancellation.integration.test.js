'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('aborted chat requests cancel provider fetches and release queued text slots', { timeout: 20000 }, async t => {
  const port = 32000 + (process.pid % 2000);
  const preload = path.join(__dirname, 'mock-provider-fetch.cjs');
  const nodeOptions = [process.env.NODE_OPTIONS || '', '--require=' + preload].filter(Boolean).join(' ');
  const child = spawn(process.execPath, ['local-gateway.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      NODE_OPTIONS: nodeOptions,
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

  const waitFor = async (predicate, label, timeoutMs = 6000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (predicate()) return;
      if (child.exitCode !== null) throw new Error('gateway exited while waiting for ' + label + '\n' + output.slice(-5000));
      await sleep(20);
    }
    throw new Error('timed out waiting for ' + label + '\n' + output.slice(-5000));
  };

  t.after(async () => {
    if (child.exitCode === null) child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      sleep(3000)
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  });

  await waitFor(() => output.includes('My AI Unified core listening on ' + port), 'gateway startup');
  const endpoint = 'http://127.0.0.1:' + port + '/chat';
  const body = prompt => JSON.stringify({ prompt });

  const controllers = Array.from({ length: 4 }, () => new AbortController());
  const firstRequests = controllers.map((controller, index) =>
    fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'cancel-test-' + index },
      body: body('Проверка отмены запроса номер ' + index),
      signal: controller.signal
    }).then(async response => ({ response, payload: await response.json() }))
      .catch(error => ({ error }))
  );

  await waitFor(() => (output.match(/MOCK_PROVIDER_STARTED:/g) || []).length >= 4, 'four active provider calls');
  const fifthPromise = fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-request-id': 'cancel-test-queued' },
    body: body('Проверка освобождения слота после отмены')
  }).then(async response => ({ status: response.status, payload: await response.json() }));

  await waitFor(() => (output.match(/CHAT_REQUEST_START/g) || []).length >= 5, 'fifth request queued');
  await sleep(100);
  assert.equal((output.match(/MOCK_PROVIDER_STARTED:5/g) || []).length, 0, 'fifth provider call must wait while all four slots are occupied');

  controllers.forEach(controller => controller.abort());
  await waitFor(() => (output.match(/MOCK_PROVIDER_ABORTED:/g) || []).length >= 4, 'all abandoned provider fetches cancelled');
  await waitFor(() => output.includes('MOCK_PROVIDER_STARTED:5'), 'queued request admitted after a slot is released');

  const fifth = await Promise.race([
    fifthPromise,
    sleep(5000).then(() => { throw new Error('queued request did not complete\n' + output.slice(-5000)); })
  ]);
  assert.equal(fifth.status, 200);
  assert.equal(fifth.payload.ok, true);
  assert.equal(fifth.payload.result, 'MOCK_OK_5');
  assert.match(output, /AI_PROVIDER_CANCELLED/);

  await Promise.all(firstRequests);
});
