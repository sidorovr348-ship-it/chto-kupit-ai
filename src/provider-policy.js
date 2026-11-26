'use strict';

const QWEN_TEXT_OUTPUT_TOKENS = 2048;
const QWEN_VISION_OUTPUT_TOKENS = 1024;
const QWEN_TEXT_TIMEOUT_MS = 7000;
const DEFAULT_TEXT_TIMEOUT_MS = 2200;
const VISION_TIMEOUT_MS = 15000;

function applyProviderPolicy(body, model, vision = false) {
  const id = String(model || '').toLowerCase();

  if (id.startsWith('openai/gpt-oss-')) {
    body.reasoning_effort = 'low';
    body.max_completion_tokens = id.endsWith('gpt-oss-20b') ? 256 : 512;
    delete body.max_tokens;
    return body;
  }

  if (id.startsWith('qwen/qwen3.')) {
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
  if (String(model || '').toLowerCase().startsWith('qwen/qwen3.')) return QWEN_TEXT_TIMEOUT_MS;
  return DEFAULT_TEXT_TIMEOUT_MS;
}

module.exports = { applyProviderPolicy, providerTimeoutMs };
