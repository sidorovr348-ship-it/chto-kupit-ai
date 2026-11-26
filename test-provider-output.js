'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyProviderOutputBudget,
  providerTimeoutMs,
  readProviderCompletion
} = require('./src/provider-output');

function basePayload() {
  return { model: 'placeholder', messages: [], temperature: 0.2, max_tokens: 700 };
}

test('Qwen text requests have a 1024-token output budget', () => {
  const payload = applyProviderOutputBudget(basePayload(), 'qwen/qwen3.8-27b', false);
  assert.equal(payload.max_completion_tokens, 1024);
  assert.equal(Object.hasOwn(payload, 'max_tokens'), false);
});

test('Qwen vision requests retain their separate 1024-token output budget', () => {
  const payload = applyProviderOutputBudget(basePayload(), 'qwen/qwen3.8-27b', true);
  assert.equal(payload.max_completion_tokens, 1024);
  assert.equal(Object.hasOwn(payload, 'max_tokens'), false);
});

test('GPT-OSS 20B and 120B budgets remain unchanged', () => {
  const small = applyProviderOutputBudget(basePayload(), 'openai/gpt-oss-20b', false);
  const large = applyProviderOutputBudget(basePayload(), 'openai/gpt-oss-120b', false);
  assert.equal(small.max_completion_tokens, 256);
  assert.equal(large.max_completion_tokens, 512);
  assert.equal(small.reasoning_effort, 'low');
  assert.equal(large.reasoning_effort, 'low');
});

test('unrelated models keep their original payload limits', () => {
  const payload = applyProviderOutputBudget(basePayload(), 'vendor/other-model', false);
  assert.equal(payload.max_tokens, 700);
  assert.equal(Object.hasOwn(payload, 'max_completion_tokens'), false);
});


test('Qwen text gets enough time for its expanded output budget', () => {
  assert.equal(providerTimeoutMs('qwen/qwen3.8-27b', false), 6000);
  assert.equal(providerTimeoutMs('qwen/qwen3.8-27b', true), 15000);
  assert.equal(providerTimeoutMs('openai/gpt-oss-120b', false), 2200);
});

test('complete provider responses return their text', () => {
  assert.equal(
    readProviderCompletion({ choices: [{ finish_reason: 'stop', message: { content: 'Полный ответ' } }] }),
    'Полный ответ'
  );
});

test('length-limited provider responses are rejected instead of returned as complete', () => {
  assert.throws(
    () => readProviderCompletion({ choices: [{ finish_reason: 'length', message: { content: 'Обрезанный ответ' } }] }),
    error => error.code === 'AI_PROVIDER_OUTPUT_TRUNCATED' && error.status === 422
  );
});
