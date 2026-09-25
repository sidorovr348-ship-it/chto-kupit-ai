import { Buffer } from 'node:buffer';

const API = process.env.API_URL || 'https://ai.aliceq.ru';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAYElEQVR4nO3PQQ0AIBDAMMC/50MEj4ZkVbDtmVk/OzrgVQNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgPaBXKqA31N0fbGAAAAAElFTkSuQmCC';

async function req(path, body, options = {}) {
  const response = await fetch(API + path, {
    method: options.method || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeout || 180000),
    cache: 'no-store'
  });
  const raw = await response.text();
  let json = {};
  try { json = raw ? JSON.parse(raw) : {}; } catch {}
  if (!response.ok) throw new Error(path + ' HTTP ' + response.status + ': ' + (json.error || raw.slice(0, 500)));
  return json;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function task(kind, input = {}, goal = '') {
  const runId = 'lab-full-e2e-' + kind + '-' + Date.now().toString(36);
  const result = await req('/autonomy/task', {
    runId,
    taskId: runId,
    kind,
    goal: goal || 'Полная проверка лабораторного контура: ' + kind,
    input
  });
  assert(result.ok === true, kind + ': autonomy task not accepted');
  assert(result.status === 'ACCEPTED', kind + ': status is not ACCEPTED');
  assert(result.result?.verification?.status === 'PASS', kind + ': verification is not PASS');
  return result;
}

(async () => {
  const status = await req('/autonomy/status', undefined, { method: 'GET', timeout: 30000 });
  assert(status.ok && status.autonomy?.mode === 'FULL_BOUNDED', 'autonomy is not FULL_BOUNDED');
  assert(status.autonomy?.connectedToCore === true, 'autonomy is not connected to core');

  const self = await req('/autonomy/self-check', {});
  assert(self.ok && self.coreConnected === true, 'autonomy self-check did not confirm core connection');

  const results = {};
  results.chat = await task('chat', { prompt: 'Ответь одним словом: ОК' });
  results.search = await task('search', { query: 'OpenAI' });
  results.shopping = await task('shopping', { query: 'iPhone 18 Pro Москва' });
  results.vision = await task('vision', { prompt: 'Кратко опиши тестовое изображение.', images: [png] });
  results.document = await task('document', {
    name: 'lab-test.txt',
    mime: 'text/plain',
    file: 'data:text/plain;base64,' + Buffer.from('Лабораторный тест документа. Слово ПРОЙДЕНО.').toString('base64')
  });
  results.tts = await task('tts', { text: 'Проверка лабораторного TTS.' });

  const tts = await req('/tts', { text: 'Проверка лабораторного STT.' }, { timeout: 120000 });
  assert(tts && tts.ok !== false, 'direct TTS bootstrap failed');
  const audio = Buffer.from(await (await fetch(API + '/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Проверка лабораторного STT.' }),
    signal: AbortSignal.timeout(120000)
  })).arrayBuffer()).toString('base64');
  results.stt = await task('stt', { audio: 'data:audio/mpeg;base64,' + audio });

  results.location = await task('location', { lat: 55.7558, lon: 37.6173 });
  results.time = await task('time', {});
  results['image-generation'] = await task('image-generation', { prompt: 'Простой красный круг на белом фоне.' }, 'Проверить лабораторную генерацию изображения');
  results.alice = await task('alice', { command: 'Кто ты?' });

  console.log('AUTONOMY_FULL_CAPABILITY_E2E_OK');
  console.log(JSON.stringify({
    status: status.autonomy,
    selfCheck: { ok: self.ok, coreConnected: self.coreConnected },
    kinds: Object.fromEntries(Object.keys(results).map(k => [k, results[k].status]))
  }));
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
