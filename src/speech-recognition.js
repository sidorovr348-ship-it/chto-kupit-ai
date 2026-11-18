'use strict';

const { transcribeWithGigaam } = require('./gigaam-stt');

async function recognizeSpeech({
  audio,
  mime = 'audio/webm',
  filename = 'voice.webm',
  gigaam = {},
  groq = {},
  fetchImpl = globalThis.fetch,
  timeoutMs = 60000
} = {}) {
  let gigaamError = null;
  if (gigaam.enabled && gigaam.baseUrl && gigaam.apiKey) {
    try {
      const result = await transcribeWithGigaam({
        enabled: true,
        baseUrl: gigaam.baseUrl,
        apiKey: gigaam.apiKey,
        audio,
        mime,
        filename,
        timeoutMs,
        fetchImpl
      });
      if (result.available) return { text: result.text, provider: result.provider, model: 'gigaam-v3' };
    } catch (error) {
      // A timed-out request may still be processing upstream. Do not start a
      // second transcription request for the same audio in that case.
      if (error?.code === 'GIGAAM_STT_TIMEOUT') throw error;
      gigaamError = error;
    }
  }

  if (!groq.apiKey) {
    if (gigaamError) throw gigaamError;
    throw Object.assign(new Error('Распознавание голоса не настроено.'), {
      status: 503,
      code: 'STT_NOT_CONFIGURED'
    });
  }
  if (typeof fetchImpl !== 'function') {
    throw Object.assign(new Error('HTTP-клиент распознавания недоступен.'), {
      status: 503,
      code: 'STT_FETCH_UNAVAILABLE'
    });
  }
  if (!Buffer.isBuffer(audio) || audio.length === 0) {
    throw Object.assign(new Error('Пустая аудиозапись.'), { status: 400, code: 'STT_EMPTY_AUDIO' });
  }
  if (audio.length > 25 * 1024 * 1024) {
    throw Object.assign(new Error('Аудиозапись слишком большая.'), { status: 413, code: 'STT_AUDIO_TOO_LARGE' });
  }

  const form = new FormData();
  form.append('file', new Blob([audio], { type: String(mime || 'application/octet-stream') }), String(filename || 'voice.webm'));
  form.append('model', String(groq.model || 'whisper-large-v3-turbo'));
  form.append('language', 'ru');
  form.append('response_format', 'json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(groq.endpoint || 'https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + groq.apiKey },
      body: form,
      signal: controller.signal
    });
    const raw = await response.text();
    let payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch {}
    if (!response.ok) {
      throw Object.assign(new Error('Распознавание HTTP ' + response.status + ': ' +
        String(payload?.error?.message || raw || 'без описания ошибки').slice(0, 300)), {
        status: response.status,
        code: response.status === 429 ? 'GROQ_STT_RATE_LIMITED' : 'GROQ_STT_UPSTREAM_ERROR'
      });
    }
    const text = String(payload?.text || '').trim();
    if (!text) throw Object.assign(new Error('Groq не вернул распознанный текст.'), {
      status: 502,
      code: 'GROQ_STT_EMPTY_RESPONSE'
    });
    return { text, provider: 'groq', model: String(groq.model || 'whisper-large-v3-turbo') };
  } catch (error) {
    if (error?.name === 'AbortError') throw Object.assign(new Error('Groq не завершил распознавание за отведённое время.'), {
      status: 504,
      code: 'GROQ_STT_TIMEOUT'
    });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { recognizeSpeech };
