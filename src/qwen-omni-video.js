'use strict';

const MAX_BASE64_CHARS = 10 * 1024 * 1024;
const DEFAULT_MODEL = 'qwen3.8-omni-flash';

function parseVideoDataUrl(value) {
  const match = String(value || '').match(/^data:(video\/(?:mp4|quicktime|x-m4v|x-matroska|x-msvideo|x-flv|x-ms-wmv));base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) {
    throw Object.assign(new Error('Видео должно быть передано как корректный Base64 data URL в поддерживаемом формате.'), {
      status: 400,
      code: 'QWEN_OMNI_INVALID_VIDEO'
    });
  }
  const encoded = match[2];
  if (encoded.length >= MAX_BASE64_CHARS) {
    throw Object.assign(new Error('Для прямой отправки в Qwen видео должно занимать менее 10 МБ в Base64. Выбери более короткий или сжатый файл.'), {
      status: 413,
      code: 'QWEN_OMNI_VIDEO_TOO_LARGE'
    });
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.toString('base64') !== encoded) {
    throw Object.assign(new Error('Не удалось проверить содержимое видеофайла.'), {
      status: 400,
      code: 'QWEN_OMNI_INVALID_VIDEO'
    });
  }
  return 'data:;base64,' + encoded;
}

function extractText(content) {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === 'string') return part;
      return typeof part?.text === 'string' ? part.text : '';
    }).filter(Boolean).join('\n').trim();
  }
  return '';
}

async function analyzeVideo({
  enabled = false,
  apiKey = '',
  baseUrl = '',
  model = DEFAULT_MODEL,
  video,
  prompt = 'Подробно проанализируй видео и звук. Опиши события по порядку, важные детали и речь. Не выдумывай того, чего нельзя увидеть или услышать.',
  timeoutMs = 180000,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!enabled || !apiKey || !baseUrl) return { available: false };
  if (typeof fetchImpl !== 'function') {
    throw Object.assign(new Error('HTTP-клиент недоступен.'), { status: 503, code: 'QWEN_OMNI_FETCH_UNAVAILABLE' });
  }

  const videoData = parseVideoDataUrl(video);
  let base;
  try {
    base = new URL(String(baseUrl).replace(/\/+$/, ''));
  } catch {
    throw Object.assign(new Error('Неверно задан адрес Qwen Model Studio.'), { status: 500, code: 'QWEN_OMNI_BASE_URL_INVALID' });
  }
  if (base.protocol !== 'https:' || !/\/v1$/i.test(base.pathname)) {
    throw Object.assign(new Error('Адрес Qwen должен быть HTTPS-адресом совместимого API и заканчиваться на /v1.'), {
      status: 500,
      code: 'QWEN_OMNI_BASE_URL_INVALID'
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const endpoint = new URL(base.toString().replace(/\/+$/, '') + '/chat/completions');
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: String(prompt || '').slice(0, 8000) },
            { type: 'video_url', video_url: { url: videoData } }
          ]
        }],
        modalities: ['text'],
        enable_thinking: false,
        max_tokens: 2048,
        stream: false
      }),
      signal: controller.signal
    });

    const raw = await response.text();
    let payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch {}

    if (!response.ok) {
      const status = response.status === 429 ? 503 : 502;
      const code = response.status === 401 || response.status === 403
        ? 'QWEN_OMNI_AUTH_FAILED'
        : response.status === 429
          ? 'QWEN_OMNI_RATE_LIMITED'
          : 'QWEN_OMNI_UPSTREAM_ERROR';
      throw Object.assign(new Error('Qwen Model Studio вернул HTTP ' + response.status + ': ' +
        String(payload?.error?.message || payload?.message || raw || 'без описания ошибки').slice(0, 350)), {
        status,
        code
      });
    }

    const choice = payload?.choices?.[0] || {};
    if (['length', 'max_tokens'].includes(String(choice.finish_reason || '').toLowerCase())) {
      throw Object.assign(new Error('Qwen завершил анализ по лимиту токенов; такой ответ нельзя считать полным.'), {
        status: 502,
        code: 'QWEN_OMNI_OUTPUT_TRUNCATED'
      });
    }
    const result = extractText(choice?.message?.content);
    if (!result) {
      throw Object.assign(new Error('Qwen не вернул текстовый результат анализа видео.'), {
        status: 502,
        code: 'QWEN_OMNI_EMPTY_RESPONSE'
      });
    }
    return { available: true, result, provider: 'qwen-omni', model: model || DEFAULT_MODEL };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw Object.assign(new Error('Qwen не завершил анализ видео за отведённое время.'), {
        status: 504,
        code: 'QWEN_OMNI_TIMEOUT'
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { analyzeVideo, parseVideoDataUrl, extractText, MAX_BASE64_CHARS };
