'use strict';

const QWEN_TEXT_OUTPUT_TOKENS = 1024;
const QWEN_VISION_OUTPUT_TOKENS = 1024;
const QWEN_TEXT_TIMEOUT_MS = 6000;
const DEFAULT_TEXT_TIMEOUT_MS = 2200;
const VISION_TIMEOUT_MS = 15000;

function applyProviderOutputBudget(body, model, vision = false) {
  if (/^openai\/gpt-oss-/i.test(String(model || ''))) {
    body.reasoning_effort = 'low';
    body.max_completion_tokens = /(?:^|\/)gpt-oss-20b$/i.test(model) ? 256 : 512;
    delete body.max_tokens;
    return body;
  }

  if (/^qwen\/qwen3\./i.test(String(model || ''))) {
    body.max_completion_tokens = vision ? QWEN_VISION_OUTPUT_TOKENS : QWEN_TEXT_OUTPUT_TOKENS;
    body.temperature = 0.55;
    body.reasoning_effort = 'none';
    body.reasoning_format = 'hidden';
    delete body.max_tokens;
  }

  return body;
}

function providerTimeoutMs(model, vision = false) {
  if (vision) return VISION_TIMEOUT_MS;
  if (/^qwen\/qwen3\./i.test(String(model || ''))) return QWEN_TEXT_TIMEOUT_MS;
  return DEFAULT_TEXT_TIMEOUT_MS;
}

function readProviderCompletion(data) {
  const choice = data?.choices?.[0] || {};
  if (choice.finish_reason === 'length') {
    throw Object.assign(new Error('AI_PROVIDER_OUTPUT_TRUNCATED'), {
      code: 'AI_PROVIDER_OUTPUT_TRUNCATED',
      status: 422,
      finishReason: choice.finish_reason,
      completionTokens: data?.usage?.completion_tokens ?? null
    });
  }
  return choice?.message?.content || choice?.text || '';
}

module.exports = {
  applyProviderOutputBudget,
  providerTimeoutMs,
  readProviderCompletion
};
