'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('aborted STT request cancels the Groq transcription fetch', { timeout: 12000 }, async t => {
  const port = 34000 + (process.pid % 1000);
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

  const waitFor = async (predicate, label, timeoutMs = 5000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (predicate()) return;
      if (child.exitCode !== null) throw new Error('gateway exited while waiting for ' + label + '\n' + output.slice(-4000));
      await sleep(20);
    }
    throw new Error('timed out waiting for ' + label + '\n' + output.slice(-4000));
  };

  t.after(async () => {
    if (child.exitCode === null) child.kill('SIGTERM');
    if (child.exitCode === null) await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      sleep(2000)
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  });

  await waitFor(() => output.includes('My AI Unified core listening on ' + port), 'gateway startup');
  const controller = new AbortController();
  const pending = fetch('http://127.0.0.1:' + port + '/transcribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ audio: 'data:audio/webm;base64,AA==' }),
    signal: controller.signal
  }).catch(error => error);

  await waitFor(() => output.includes('MOCK_STT_STARTED'), 'STT provider request');
  controller.abort();
  await waitFor(() => output.includes('MOCK_STT_ABORTED'), 'provider fetch cancellation');
  const clientResult = await pending;
  assert.ok(clientResult instanceof Error, 'client-side fetch should observe its own abort');
  assert.match(output, /STT_CLIENT_DISCONNECTED|CHAT_REQUEST_CLIENT_CLOSED|MOCK_STT_ABORTED/);
});
