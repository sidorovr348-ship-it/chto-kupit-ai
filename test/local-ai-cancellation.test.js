'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { callOllama } = require('../src/local-ai');

function abortableFetch() {
  let observedSignal = null;
  const fetch = (_url, options = {}) => new Promise((resolve, reject) => {
    observedSignal = options.signal;
    const onAbort = () => {
      observedSignal?.removeEventListener('abort', onAbort);
      const error = new Error('mock Ollama request aborted');
      error.name = 'AbortError';
      reject(error);
    };
    if (observedSignal?.aborted) return onAbort();
    observedSignal?.addEventListener('abort', onAbort, { once: true });
  });
  return { fetch, get signal() { return observedSignal; } };
}

test('local Ollama request receives and obeys client cancellation', async () => {
  const originalFetch = global.fetch;
  const mock = abortableFetch();
  global.fetch = mock.fetch;
  try {
    const external = new AbortController();
    const pending = callOllama([{ role: 'user', content: 'test' }], {
      timeoutMs: 1000,
      signal: external.signal
    }).catch(error => error);
    for (let i = 0; i < 50 && !mock.signal; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(mock.signal, 'Ollama fetch should have started');
    external.abort();
    const error = await pending;
    assert.equal(mock.signal.aborted, true);
    assert.equal(error.status, 499);
    assert.equal(error.code, 'CHAT_REQUEST_CANCELLED');
  } finally {
    global.fetch = originalFetch;
  }
});

test('local Ollama timeout remains a timeout, not a client cancellation', async () => {
  const originalFetch = global.fetch;
  const mock = abortableFetch();
  global.fetch = mock.fetch;
  try {
    const error = await callOllama([{ role: 'user', content: 'test' }], {
      timeoutMs: 10
    }).catch(value => value);
    assert.equal(mock.signal.aborted, true);
    assert.equal(error.status, 504);
    assert.equal(error.code, undefined);
  } finally {
    global.fetch = originalFetch;
  }
});
