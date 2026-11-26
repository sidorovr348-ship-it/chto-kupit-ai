'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { applyProviderPolicy, providerTimeoutMs } = require('../src/provider-policy');

function payload() {
  return { model: 'placeholder', messages: [], temperature: 0.2, max_tokens: 700 };
}

test('Qwen text gets a 2048-token output budget and a matching timeout', () => {
  const body = applyProviderPolicy(payload(), 'qwen/qwen3.8-27b', false);
  assert.equal(body.max_completion_tokens, 2048);
  assert.equal(Object.hasOwn(body, 'max_tokens'), false);
  assert.equal(body.temperature, 0.55);
  assert.equal(providerTimeoutMs('qwen/qwen3.8-27b', false), 7000);
});

test('Qwen vision keeps its independent 1024-token budget and vision timeout', () => {
  const body = applyProviderPolicy(payload(), 'qwen/qwen3.8-27b', true);
  assert.equal(body.max_completion_tokens, 1024);
  assert.equal(Object.hasOwn(body, 'max_tokens'), false);
  assert.equal(providerTimeoutMs('qwen/qwen3.8-27b', true), 15000);
});

test('GPT-OSS 20B and 120B receive their intended distinct budgets', () => {
  const small = applyProviderPolicy(payload(), 'openai/gpt-oss-20b', false);
  const large = applyProviderPolicy(payload(), 'openai/gpt-oss-120b', false);
  assert.equal(small.max_completion_tokens, 256);
  assert.equal(large.max_completion_tokens, 512);
  assert.equal(small.reasoning_effort, 'low');
  assert.equal(large.reasoning_effort, 'low');
});

test('unrelated providers retain their original payload and timeout defaults', () => {
  const body = applyProviderPolicy(payload(), 'vendor/other-model', false);
  assert.equal(body.max_tokens, 700);
  assert.equal(Object.hasOwn(body, 'max_completion_tokens'), false);
  assert.equal(providerTimeoutMs('vendor/other-model', false), 2200);
});
