'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('shared photo inference is cancelled only after every client disconnects', { timeout: 15000 }, async t => {
  const port = 38000 + (process.pid % 1000);
  const preload = path.join(__dirname, 'mock-provider-fetch.cjs');
  const nodeOptions = [process.env.NODE_OPTIONS || '', '--require=' + preload].filter(Boolean).join(' ');
  const child = spawn(process.execPath, ['local-gateway.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      NODE_OPTIONS: nodeOptions,
      MOCK_VISION_HANG: '1',
      GROQ_API_KEY: 'mock-provider-key',
      MISTRAL_API_KEY: '',
      OPENAI_API_KEY: '',
      DEEPSEEK_API_KEY: '',
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
      if (child.exitCode !== null) throw new Error('gateway exited while waiting for ' + label + '\\n' + output.slice(-5000));
      await sleep(20);
    }
    throw new Error('timed out waiting for ' + label + '\\n' + output.slice(-5000));
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
  const endpoint = 'http://127.0.0.1:' + port + '/photo';
  const body = JSON.stringify({ image: 'data:image/jpeg;base64,AA==', prompt: 'Опиши изображение.' });
  const request = signal => fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    signal
  }).catch(error => error);

  const firstController = new AbortController();
  const first = request(firstController.signal);
  await waitFor(() => output.includes('MOCK_VISION_STARTED'), 'vision provider request');

  const secondController = new AbortController();
  const second = request(secondController.signal);
  await waitFor(() => (output.match(/PHOTO_REQUEST_ATTACHED/g) || []).length >= 2, 'second photo subscriber');
  assert.equal((output.match(/MOCK_VISION_STARTED/g) || []).length, 1, 'identical photo requests must share one provider inference');

  firstController.abort();
  await sleep(150);
  assert.equal((output.match(/MOCK_VISION_ABORTED/g) || []).length, 0, 'one disconnected subscriber must not cancel inference needed by another client');

  secondController.abort();
  await waitFor(() => output.includes('MOCK_VISION_ABORTED'), 'vision provider cancellation after final subscriber leaves');
  assert.ok((await first) instanceof Error);
  assert.ok((await second) instanceof Error);
});
