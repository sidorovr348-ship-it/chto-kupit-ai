'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createProviderCancellation, createClientCancellationError } = require('../src/provider-cancellation');

test('client disconnect aborts the provider signal and is classified separately', () => {
  const external = new AbortController();
  const request = createProviderCancellation(1000, external.signal);
  external.abort();
  assert.equal(request.signal.aborted, true);
  assert.equal(request.source(), 'client');
  const error = createClientCancellationError();
  assert.equal(error.status, 499);
  assert.equal(error.code, 'CHAT_REQUEST_CANCELLED');
  request.clear();
});

test('provider timeout is distinguished from a client disconnect', async () => {
  const request = createProviderCancellation(5, null);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(request.signal.aborted, true);
  assert.equal(request.source(), 'timeout');
  request.clear();
});

test('server route deadline is classified separately from a client disconnect', () => {
  const external = new AbortController();
  external.abort(new Error('CHAT_ROUTE_DEADLINE'));
  const request = createProviderCancellation(1000, external.signal);
  assert.equal(request.signal.aborted, true);
  assert.equal(request.source(), 'deadline');
  request.clear();
});

test('an already-aborted client signal aborts immediately', () => {
  const external = new AbortController();
  external.abort();
  const request = createProviderCancellation(1000, external.signal);
  assert.equal(request.signal.aborted, true);
  assert.equal(request.source(), 'client');
  request.clear();
});

test('cleanup clears the provider timeout', async () => {
  const request = createProviderCancellation(10, null);
  request.clear();
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(request.signal.aborted, false);
  assert.equal(request.source(), null);
});
