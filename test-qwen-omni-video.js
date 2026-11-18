'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeVideo, parseVideoDataUrl, extractText, MAX_BASE64_CHARS } = require('./src/qwen-omni-video');
const tinyVideo = 'data:video/mp4;base64,' + Buffer.from('video-bytes').toString('base64');

test('Qwen Omni stays disabled unless explicitly enabled and configured', async () => {
  assert.deepEqual(await analyzeVideo({ enabled: false, video: tinyVideo }), { available: false });
  assert.deepEqual(await analyzeVideo({ enabled: true, apiKey: 'key', video: tinyVideo }), { available: false });
});
test('video data URL is validated and converted to documented provider format', () => {
  assert.equal(parseVideoDataUrl(tinyVideo), 'data:;base64,' + Buffer.from('video-bytes').toString('base64'));
  assert.throws(() => parseVideoDataUrl('data:image/png;base64,YQ=='), /поддерживаемом формате/);
  assert.throws(() => parseVideoDataUrl('not-a-data-url'), /поддерживаемом формате/);
});
test('encoded video larger than the documented limit is rejected before network use', () => {
  assert.throws(() => parseVideoDataUrl('data:video/mp4;base64,' + 'A'.repeat(MAX_BASE64_CHARS)),
    error => error.code === 'QWEN_OMNI_VIDEO_TOO_LARGE');
});
test('Qwen Omni sends original video and returns text without exposing API key', async () => {
  let request;
  const result = await analyzeVideo({
    enabled: true, apiKey: 'secret-test-key',
    baseUrl: 'https://workspace.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1',
    video: tinyVideo, prompt: 'Опиши видео',
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return { ok: true, status: 200, text: async () => JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content: 'На видео виден автомобиль.' } }]
      }) };
    }
  });
  assert.equal(result.available, true);
  assert.equal(result.result, 'На видео виден автомобиль.');
  assert.equal(result.provider, 'qwen-omni');
  assert.equal(request.url, 'https://workspace.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer secret-test-key');
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, 'qwen3.8-omni-flash');
  assert.equal(body.messages[0].content[1].type, 'video_url');
  assert.ok(body.messages[0].content[1].video_url.url.startsWith('data:;base64,'));
  assert.equal(body.messages[0].content[0].text, 'Опиши видео');
});
test('Qwen Omni rejects truncated and empty responses', async () => {
  const common = {
    enabled: true, apiKey: 'key',
    baseUrl: 'https://workspace.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1',
    video: tinyVideo,
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({
      choices: [{ finish_reason: 'length', message: { content: 'Обрезано' } }]
    }) })
  };
  await assert.rejects(analyzeVideo(common), error => error.code === 'QWEN_OMNI_OUTPUT_TRUNCATED');
  await assert.rejects(analyzeVideo({ ...common, fetchImpl: async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '' } }] })
  }) }), error => error.code === 'QWEN_OMNI_EMPTY_RESPONSE');
});
test('Qwen Omni maps rate limits and validates HTTPS endpoint', async () => {
  const common = { enabled: true, apiKey: 'key',
    baseUrl: 'https://workspace.example/compatible-mode/v1', video: tinyVideo };
  await assert.rejects(analyzeVideo({ ...common, fetchImpl: async () => ({
    ok: false, status: 429, text: async () => '{"error":{"message":"rate limited"}}'
  }) }), error => error.code === 'QWEN_OMNI_RATE_LIMITED' && error.status === 503);
  await assert.rejects(analyzeVideo({ ...common, baseUrl: 'http://workspace.example/compatible-mode/v1' }),
    error => error.code === 'QWEN_OMNI_BASE_URL_INVALID');
});
test('extractText handles string and multipart text responses', () => {
  assert.equal(extractText(' plain '), 'plain');
  assert.equal(extractText([{ text: 'one' }, { text: 'two' }]), 'one\ntwo');
});
