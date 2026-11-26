'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { extractChatCompletion } = require('../src/provider-response');

test('extracts a complete chat completion and preserves finish reason', () => {
  const result = extractChatCompletion({
    choices: [{ finish_reason: 'stop', message: { content: 'Полный ответ.' } }],
    usage: { completion_tokens: 12 }
  });
  assert.deepEqual(result, {
    content: 'Полный ответ.',
    finishReason: 'stop',
    completionTokens: 12
  });
});

test('rejects a response truncated by the provider token limit', () => {
  assert.throws(
    () => extractChatCompletion({
      choices: [{ finish_reason: 'length', message: { content: 'Оборванный ответ' } }]
    }),
    error => error.code === 'AI_PROVIDER_OUTPUT_TRUNCATED' && error.status === 409
  );
});

test('rejects an empty successful provider response', () => {
  assert.throws(
    () => extractChatCompletion({ choices: [{ finish_reason: 'stop', message: { content: '   ' } }] }),
    error => error.code === 'AI_PROVIDER_EMPTY_RESPONSE' && error.status === 502
  );
});

test('supports the legacy text field used by compatible providers', () => {
  const result = extractChatCompletion({ choices: [{ text: 'Ответ из text.' }] });
  assert.equal(result.content, 'Ответ из text.');
});
