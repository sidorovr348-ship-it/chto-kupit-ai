'use strict';

function normalizeBaseUrl(value) {
  let base;
  try { base = new URL(String(value || '').replace(/\/+$/, '')); }
  catch { throw Object.assign(new Error('Неверный адрес GigaAM STT.'), { status: 500, code: 'GIGAAM_STT_BASE_URL_INVALID' }); }
  if (base.protocol !== 'https:' || !/\/v1$/i.test(base.pathname)) {
    throw Object.assign(new Error('GigaAM STT должен использовать HTTPS и адрес API, заканчивающийся на /v1.'), {
      status: 500, code: 'GIGAAM_STT_BASE_URL_INVALID'
    });
  }
  return base;
}

async function transcribeWithGigaam({
  enabled = false, baseUrl = '', apiKey = '', audio, mime = 'audio/webm',
  filename = 'voice.webm', timeoutMs = 60000, fetchImpl = globalThis.fetch
} = {}) {
  if (!enabled || !baseUrl || !apiKey) return { available: false };
  if (!Buffer.isBuffer(audio) || audio.length === 0) {
    throw Object.assign(new Error('Пустой аудиофайл для GigaAM.'), { status: 400, code: 'GIGAAM_STT_EMPTY_AUDIO' });
  }
  if (audio.length > 25 * 1024 * 1024) {
    throw Object.assign(new Error('Аудиофайл превышает лимит 25 МБ.'), { status: 413, code: 'GIGAAM_STT_AUDIO_TOO_LARGE' });
  }
  if (typeof fetchImpl !== 'function') {
    throw Object.assign(new Error('HTTP-клиент GigaAM недоступен.'), { status: 503, code: 'GIGAAM_STT_FETCH_UNAVAILABLE' });
  }
  const base = normalizeBaseUrl(baseUrl);
  const endpoint = new URL(base.toString().replace(/\/+$/, '') + '/audio/transcriptions');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const form = new FormData();
    form.append('file', new Blob([audio], { type: String(mime || 'application/octet-stream') }), String(filename || 'voice.webm'));
    form.append('model', 'whisper-1');
    form.append('language', 'ru');
    form.append('response_format', 'json');
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey },
      body: form,
      signal: controller.signal
    });
    const raw = await response.text();
    let payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch {}
    if (!response.ok) {
      throw Object.assign(new Error('GigaAM STT вернул HTTP ' + response.status + ': ' +
        String(payload?.error?.message || payload?.detail || raw || 'без описания ошибки').slice(0, 300)), {
        status: response.status === 429 ? 503 : 502,
        code: response.status === 401 || response.status === 403 ? 'GIGAAM_STT_AUTH_FAILED' :
          response.status === 429 ? 'GIGAAM_STT_RATE_LIMITED' : 'GIGAAM_STT_UPSTREAM_ERROR'
      });
    }
    const text = String(payload?.text || '').trim();
    if (!text) throw Object.assign(new Error('GigaAM не вернул распознанный текст.'), {
      status: 502, code: 'GIGAAM_STT_EMPTY_RESPONSE'
    });
    return { available: true, text, provider: 'gigaam-v3' };
  } catch (error) {
    if (error?.name === 'AbortError') throw Object.assign(new Error('GigaAM не завершил распознавание за отведённое время.'), {
      status: 504, code: 'GIGAAM_STT_TIMEOUT'
    });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { transcribeWithGigaam, normalizeBaseUrl };
