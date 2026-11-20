'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAudioDataUrl } = require('./src/audio-data-url');

test('parses audio data URL with MediaRecorder codec parameters', () => {
  const encoded = Buffer.from('voice').toString('base64');
  const parsed = parseAudioDataUrl('data:audio/webm;codecs=opus;base64,' + encoded);
  assert.equal(parsed.mime, 'audio/webm');
  assert.equal(parsed.buffer.toString(), 'voice');
});
test('parses common audio data URL formats', () => {
  for (const mime of ['audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg']) {
    const parsed = parseAudioDataUrl('data:' + mime + ';base64,' + Buffer.from('x').toString('base64'));
    assert.equal(parsed.mime, mime);
  }
});
test('rejects malformed, non-audio and oversized data URLs', () => {
  assert.throws(() => parseAudioDataUrl('not-data'));
  assert.throws(() => parseAudioDataUrl('data:image/png;base64,YQ=='), error => error.code === 'AUDIO_DATA_URL_INVALID');
  assert.throws(() => parseAudioDataUrl('data:audio/webm;base64,' + Buffer.from('12345').toString('base64'), 4),
    error => error.code === 'AUDIO_TOO_LARGE');
});
