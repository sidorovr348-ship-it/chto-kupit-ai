'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { recognizeSpeech } = require('./src/speech-recognition');

const audio = Buffer.from('voice bytes');

test('uses GigaAM when explicitly configured and reports the real provider', async () => {
  let calls = 0;
  const result = await recognizeSpeech({
    audio, mime: 'audio/webm', filename: 'voice.webm',
    gigaam: { enabled: true, baseUrl: 'https://stt.example/v1', apiKey: 'giga-key' },
    groq: { apiKey: 'groq-key', model: 'whisper-large-v3-turbo' },
    fetchImpl: async (_url, options) => {
      calls++;
      assert.equal(options.headers.Authorization, 'Bearer giga-key');
      return { ok: true, status: 200, text: async () => '{"text":"Распознано GigaAM"}' };
    }
  });
  assert.deepEqual(result, { text: 'Распознано GigaAM', provider: 'gigaam-v3', model: 'gigaam-v3' });
  assert.equal(calls, 1, 'Groq must not be called after GigaAM success');
});

test('falls back to Groq after a definite GigaAM HTTP failure', async () => {
  const calls = [];
  const result = await recognizeSpeech({
    audio,
    gigaam: { enabled: true, baseUrl: 'https://stt.example/v1', apiKey: 'giga-key' },
    groq: { apiKey: 'groq-key', model: 'whisper-large-v3-turbo' },
    fetchImpl: async (url, options) => {
      calls.push(String(url));
      if (String(url).includes('stt.example')) return { ok: false, status: 503, text: async () => '{"detail":"not ready"}' };
      return { ok: true, status: 200, text: async () => '{"text":"Распознано резервом"}' };
    }
  });
  assert.deepEqual(result, { text: 'Распознано резервом', provider: 'groq', model: 'whisper-large-v3-turbo' });
  assert.equal(calls.length, 2);
  assert.equal(calls[1], 'https://api.groq.com/openai/v1/audio/transcriptions');
});

test('does not start a duplicate provider request after GigaAM timeout', async () => {
  let calls = 0;
  await assert.rejects(recognizeSpeech({
    audio,
    gigaam: { enabled: true, baseUrl: 'https://stt.example/v1', apiKey: 'giga-key' },
    groq: { apiKey: 'groq-key' },
    fetchImpl: async () => { calls++; const error = new Error('aborted'); error.name = 'AbortError'; throw error; }
  }), error => error.code === 'GIGAAM_STT_TIMEOUT');
  assert.equal(calls, 1);
});

test('uses Groq when GigaAM is disabled and reports missing configuration clearly', async () => {
  const result = await recognizeSpeech({
    audio,
    groq: { apiKey: 'groq-key', model: 'whisper-large-v3-turbo' },
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => '{"text":"Groq"}' })
  });
  assert.equal(result.provider, 'groq');
  await assert.rejects(recognizeSpeech({ audio }), error => error.code === 'STT_NOT_CONFIGURED');
});
