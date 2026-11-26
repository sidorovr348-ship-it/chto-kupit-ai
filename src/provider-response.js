'use strict';

function extractChatCompletion(payload) {
  const choice = payload?.choices?.[0] || {};
  const finishReason = choice.finish_reason ?? null;
  const rawContent = choice?.message?.content ?? choice?.text ?? '';
  const content = String(rawContent ?? '');

  if (finishReason === 'length') {
    throw Object.assign(new Error('AI provider response was truncated by its output-token limit'), {
      status: 409,
      code: 'AI_PROVIDER_OUTPUT_TRUNCATED'
    });
  }

  if (!content.trim()) {
    throw Object.assign(new Error('AI provider returned an empty response'), {
      status: 502,
      code: 'AI_PROVIDER_EMPTY_RESPONSE'
    });
  }

  return {
    content,
    finishReason,
    completionTokens: payload?.usage?.completion_tokens ?? null
  };
}

module.exports = { extractChatCompletion };
