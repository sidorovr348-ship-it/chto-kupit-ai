'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { providerCircuitScope, providerCircuitKey } = require('../src/provider-circuit');

const modelKey = 'https://api.example.test/chat|model-a';
const hostKey = 'https://api.example.test/chat';

test('a model timeout only opens the affected model circuit', () => {
  const error = new Error('Provider timeout');
  assert.equal(providerCircuitScope(error), 'model');
  assert.equal(providerCircuitKey(error, modelKey, hostKey), modelKey);
});

test('an abort timeout only opens the affected model circuit', () => {
  const error = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
  assert.equal(providerCircuitKey(error, modelKey, hostKey), modelKey);
});

test('a rate limit remains scoped to the model circuit', () => {
  assert.equal(providerCircuitKey({ status: 429, message: 'Too many requests' }, modelKey, hostKey), modelKey);
});

test('authentication and provider server errors open the provider circuit', () => {
  assert.equal(providerCircuitKey({ status: 401, message: 'Unauthorized' }, modelKey, hostKey), hostKey);
  assert.equal(providerCircuitKey({ status: 503, message: 'Service unavailable' }, modelKey, hostKey), hostKey);
});

test('gateway uses model-scoped circuit keys for timeout failures', () => {
  const gateway = fs.readFileSync('local-gateway.js', 'utf8');
  assert.ok(gateway.includes('providerCircuitKey(e,circuitKey,providerKey)'), 'provider catch must scope model timeouts independently');
});
