'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { firstSuccessful } = require('./src/first-success');

test('first successful provider aborts every losing provider task', async () => {
  let loserAborted = false;
  const result = await firstSuccessful([
    async () => 'usable answer',
    signal => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => { loserAborted = true; reject(new Error('aborted')); }, { once: true });
      if (signal.aborted) { loserAborted = true; reject(new Error('aborted')); }
    })
  ]);
  assert.equal(result, 'usable answer');
  assert.equal(loserAborted, true);
});

test('all provider failures reject and the race closes its signal', async () => {
  let observedSignal;
  await assert.rejects(firstSuccessful([
    async () => { throw new Error('provider A failed'); },
    signal => new Promise((resolve, reject) => {
      observedSignal = signal;
      setTimeout(() => reject(new Error('provider B failed')), 5);
    })
  ]), AggregateError);
  assert.equal(observedSignal.aborted, true);
});

test('empty provider list is rejected explicitly', async () => {
  await assert.rejects(firstSuccessful([]), AggregateError);
});
