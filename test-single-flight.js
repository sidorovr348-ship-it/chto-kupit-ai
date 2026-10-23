'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSingleFlight } = require('./src/single-flight');

test('single-flight shares one pending diagnostic across overlapping requests', async () => {
  let calls = 0;
  let finish;
  const operation = createSingleFlight(() => {
    calls++;
    return new Promise(resolve => { finish = resolve; });
  });
  const first = operation();
  const second = operation();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  finish({ ok: true });
  assert.deepEqual(await first, { ok: true });
  assert.deepEqual(await second, { ok: true });
});

test('single-flight releases the slot after a rejected diagnostic so retries can proceed', async () => {
  let calls = 0;
  const operation = createSingleFlight(async () => {
    calls++;
    if (calls === 1) throw new Error('expected failure');
    return { ok: true };
  });
  await assert.rejects(operation(), /expected failure/);
  assert.deepEqual(await operation(), { ok: true });
  assert.equal(calls, 2);
});

test('single-flight does not reuse a completed result for a later independent request', async () => {
  let calls = 0;
  const operation = createSingleFlight(async () => ({ sequence: ++calls }));
  assert.deepEqual(await operation(), { sequence: 1 });
  assert.deepEqual(await operation(), { sequence: 2 });
});
