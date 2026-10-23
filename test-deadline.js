'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDeadline } = require('./src/deadline');

test('deadline rejects a never-settling initialization with a structured timeout', async () => {
  const deadline = createDeadline(20, 'timed out', 'SELF_CHECK_TIMEOUT');
  try {
    await assert.rejects(
      Promise.race([new Promise(() => {}), deadline.promise]),
      error => error.status === 504 && error.code === 'SELF_CHECK_TIMEOUT' && error.message === 'timed out'
    );
  } finally {
    deadline.clear();
  }
});

test('one absolute deadline remains active after initialization and bounds the diagnostic', async () => {
  const deadline = createDeadline(20, 'timed out', 'SELF_CHECK_TIMEOUT');
  try {
    assert.equal(await Promise.race([Promise.resolve('initialized'), deadline.promise]), 'initialized');
    await assert.rejects(
      Promise.race([new Promise(() => {}), deadline.promise]),
      { code: 'SELF_CHECK_TIMEOUT' }
    );
  } finally {
    deadline.clear();
  }
});

test('deadline timer can be cleared after successful work', async () => {
  const deadline = createDeadline(1000, 'timed out', 'SELF_CHECK_TIMEOUT');
  deadline.clear();
  assert.equal(await Promise.race([Promise.resolve('ok'), deadline.promise]), 'ok');
});
