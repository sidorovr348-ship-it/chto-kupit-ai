'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('iOS Safari recognition sessions are primed and never cut during normal wake flow', () => {
  const html = fs.readFileSync('smart-index.html', 'utf8');
  const start = html.indexOf('<!-- EY_WAKE_WORD_V2_STATE_MACHINE -->');
  const end = html.indexOf('</script>', start);
  assert.ok(start >= 0 && end > start, 'wake state machine script must exist');
  const wake = html.slice(start, end);

  assert.match(wake, /function primeSpeechRecognition\(\)/, 'Safari speech synthesis priming must exist');
  assert.match(wake, /primeSpeechRecognition\(\)\.then/, 'recognition must wait for the priming utterance');
  assert.match(wake, /utterance\.onend=finish/, 'recognition priming must wait for speech synthesis completion');
  assert.match(wake, /x\.continuous=false/, 'Safari recognition sessions must remain single-shot');
  assert.match(wake, /x\.onend=\(\)=>[\s\S]*if\(queue\.length\)\{processQueue\(\);return\}/, 'queued commands must run after natural recognition end');
  assert.match(wake, /function enqueue\(command\)\{[\s\S]*queue\.push\(q\);[\s\S]*if\(!rec&&!starting&&!priming\)processQueue\(\)/, 'enqueue must wait for natural session end rather than aborting recognition');
  assert.match(wake, /async function processQueue\(\)\{if\(processing\|\|paused\|\|!enabled\|\|rec\|\|starting\|\|priming\)return;processing=true;clearTimers\(\);/, 'chat processing must not stop an active recognizer');
  assert.match(wake, /window\.__startManualVoice=\(\)=>\{/, 'iOS manual dictation must reuse SpeechRecognition');
  assert.match(html, /iosSpeech&&window\.__startManualVoice/, 'iOS voice button must avoid a second getUserMedia capture while wake recognition is active');
  assert.doesNotMatch(wake, /status\([^;]*Перезапускаю распознавание после тишины[^;]*\);stopCurrent\(true\)/, 'silence watchdog must not abort a Safari recognition session');
});
