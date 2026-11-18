'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { transcribeWithGigaam } = require('./src/gigaam-stt');

test('GigaAM adapter is disabled by default and requires URL plus key', async () => {
  assert.deepEqual(await transcribeWithGigaam({ audio: Buffer.from('audio') }), { available: false });
  assert.deepEqual(await transcribeWithGigaam({ enabled: true, baseUrl: 'https://host/v1', audio: Buffer.from('audio') }), { available: false });
});
test('GigaAM adapter sends OpenAI-compatible multipart request and Russian language', async () => {
  let captured;
  const result = await transcribeWithGigaam({
    enabled: true, baseUrl: 'https://stt.example/v1', apiKey: 'secret',
    audio: Buffer.from('audio-bytes'), mime: 'audio/webm', filename: 'voice.webm',
    fetchImpl: async (url, options) => {
      captured = { url: String(url), options };
      return { ok: true, status: 200, text: async () => JSON.stringify({ text: 'Проверка русского распознавания.' }) };
    }
  });
  assert.deepEqual(result, { available: true, text: 'Проверка русского распознавания.', provider: 'gigaam-v3' });
  assert.equal(captured.url, 'https://stt.example/v1/audio/transcriptions');
  assert.equal(captured.options.headers.Authorization, 'Bearer secret');
  assert.equal(captured.options.body.get('language'), 'ru');
  assert.equal(captured.options.body.get('model'), 'whisper-1');
  assert.equal(captured.options.body.get('response_format'), 'json');
  assert.equal(captured.options.body.get('file').type, 'audio/webm');
});
test('GigaAM adapter rejects insecure endpoints and empty audio', async () => {
  await assert.rejects(transcribeWithGigaam({
    enabled: true, baseUrl: 'http://stt.example/v1', apiKey: 'secret', audio: Buffer.from('a')
  }), error => error.code === 'GIGAAM_STT_BASE_URL_INVALID');
  await assert.rejects(transcribeWithGigaam({
    enabled: true, baseUrl: 'https://stt.example/v1', apiKey: 'secret', audio: Buffer.alloc(0)
  }), error => error.code === 'GIGAAM_STT_EMPTY_AUDIO');
});
test('GigaAM adapter maps auth, rate limit, empty and timeout errors', async () => {
  const common = { enabled: true, baseUrl: 'https://stt.example/v1', apiKey: 'secret', audio: Buffer.from('a') };
  await assert.rejects(transcribeWithGigaam({ ...common, fetchImpl: async () => ({
    ok: false, status: 401, text: async () => '{"detail":"bad key"}'
  }) }), error => error.code === 'GIGAAM_STT_AUTH_FAILED');
  await assert.rejects(transcribeWithGigaam({ ...common, fetchImpl: async () => ({
    ok: false, status: 429, text: async () => '{"detail":"busy"}'
  }) }), error => error.code === 'GIGAAM_STT_RATE_LIMITED' && error.status === 503);
  await assert.rejects(transcribeWithGigaam({ ...common, fetchImpl: async () => ({
    ok: true, status: 200, text: async () => '{"text":"  "}'
  }) }), error => error.code === 'GIGAAM_STT_EMPTY_RESPONSE');
  await assert.rejects(transcribeWithGigaam({ ...common, fetchImpl: async (_url, options) => {
    const error = new Error('aborted'); error.name = 'AbortError'; throw error;
  } }), error => error.code === 'GIGAAM_STT_TIMEOUT');
});
