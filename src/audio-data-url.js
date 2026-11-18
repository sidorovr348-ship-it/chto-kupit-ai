'use strict';

function parseAudioDataUrl(value, maxBytes = 25 * 1024 * 1024) {
  const match = String(value || '').match(/^data:([^,]+);base64,([A-Za-z0-9+/]+={0,2})$/s);
  if (!match) throw Object.assign(new Error('Аудио передано в неверном формате.'), {
    status: 400, code: 'AUDIO_DATA_URL_INVALID'
  });
  const header = match[1].split(';');
  if (header.pop()?.toLowerCase() !== 'base64') throw Object.assign(new Error('Ожидался Base64-аудиофайл.'), {
    status: 400, code: 'AUDIO_DATA_URL_INVALID'
  });
  const mime = String(header[0] || '').toLowerCase();
  if (!mime.startsWith('audio/')) throw Object.assign(new Error('Переданный файл не является аудио.'), {
    status: 400, code: 'AUDIO_DATA_URL_INVALID'
  });
  const encoded = match[2];
  const estimatedBytes = Math.floor(encoded.length * 3 / 4) - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
  if (estimatedBytes > maxBytes) throw Object.assign(new Error('Аудиозапись слишком большая.'), {
    status: 413, code: 'AUDIO_TOO_LARGE'
  });
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length || buffer.toString('base64') !== encoded) throw Object.assign(new Error('Не удалось проверить аудиофайл.'), {
    status: 400, code: 'AUDIO_DATA_URL_INVALID'
  });
  return { mime, buffer };
}

module.exports = { parseAudioDataUrl };
