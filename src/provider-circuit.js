'use strict';

function providerCircuitScope(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || '');
  if (status === 429 || error?.name === 'AbortError' || /aborted|timeout/i.test(message)) return 'model';
  return 'provider';
}

function providerCircuitKey(error, circuitKey, providerKey) {
  return providerCircuitScope(error) === 'model' ? circuitKey : providerKey;
}

module.exports = { providerCircuitScope, providerCircuitKey };
