'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createVideoRouteHandler } = require('./src/video-route');

function response() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; }
  };
}

const request = body => ({ body });

test('Vercel returns an explicit unavailable result when Qwen Omni is not configured', async () => {
  let frameCalls = 0;
  const res = response();
  const handler = createVideoRouteHandler({
    env: { VERCEL: '1' },
    analyzeFrames: async () => { frameCalls++; return { result: 'frame answer' }; }
  });
  await handler(request({ video: 'data:video/mp4;base64,YQ==' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.available, false);
  assert.equal(res.payload.code, 'QWEN_OMNI_NOT_CONFIGURED');
  assert.equal(frameCalls, 0);
});

test('configured Qwen Omni receives the original video and returns an audio/video result', async () => {
  let received;
  const res = response();
  const handler = createVideoRouteHandler({
    env: {
      VERCEL: '1',
      QWEN_OMNI_ENABLED: '1',
      DASHSCOPE_API_KEY: 'test-key',
      QWEN_OMNI_BASE_URL: 'https://workspace.example/compatible-mode/v1'
    },
    analyzeVideo: async options => {
      received = options;
      return { available: true, result: 'Видео и звук проанализированы.', provider: 'qwen-omni' };
    }
  });
  await handler(request({ video: 'data:video/mp4;base64,YQ==', prompt: 'Опиши видео' }), res);
  assert.equal(received.video, 'data:video/mp4;base64,YQ==');
  assert.equal(received.timeoutMs, 8000);
  assert.equal(received.prompt, 'Опиши видео');
  assert.equal(res.payload.available, true);
  assert.equal(res.payload.route, 'video');
  assert.equal(res.payload.analysisMode, 'video_and_audio');
  assert.equal(res.payload.audioAnalyzed, true);
  assert.equal(res.payload.result, 'Видео и звук проанализированы.');
});

test('Vercel maps a Qwen Omni failure to an HTTP error so the browser can use frame fallback', async () => {
  let frameCalls = 0;
  const res = response();
  const handler = createVideoRouteHandler({
    env: {
      VERCEL: '1',
      QWEN_OMNI_ENABLED: '1',
      QWEN_OMNI_API_KEY: 'test-key',
      QWEN_OMNI_BASE_URL: 'https://workspace.example/compatible-mode/v1'
    },
    analyzeVideo: async () => { throw Object.assign(new Error('upstream timeout'), { status: 504, code: 'QWEN_OMNI_TIMEOUT' }); },
    analyzeFrames: async () => { frameCalls++; return { result: 'should not run' }; },
    logger: { error() {} }
  });
  await handler(request({ video: 'data:video/mp4;base64,YQ==' }), res);
  assert.equal(res.statusCode, 504);
  assert.equal(res.payload.code, 'QWEN_OMNI_TIMEOUT');
  assert.equal(frameCalls, 0);
});

test('non-Vercel server falls back to sampled frames and labels audio as not analyzed', async () => {
  let receivedVideo;
  const res = response();
  const handler = createVideoRouteHandler({
    env: {},
    analyzeFrames: async video => {
      receivedVideo = video;
      return { result: 'В кадрах виден автомобиль.', frames: 3, model: 'qwen3.8-27b' };
    }
  });
  await handler(request({ video: 'data:video/mp4;base64,YQ==' }), res);
  assert.equal(receivedVideo, 'data:video/mp4;base64,YQ==');
  assert.equal(res.payload.available, true);
  assert.equal(res.payload.analysisMode, 'sampled_frames');
  assert.equal(res.payload.audioAnalyzed, false);
  assert.equal(res.payload.frames, 3);
});

test('video route rejects an empty request', async () => {
  const res = response();
  const handler = createVideoRouteHandler({ env: {} });
  await handler(request({}), res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /video or data is required/);
});
