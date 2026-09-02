const capabilities = require('./capabilities.json');

function dispatch({ prompt = '', hasImage = false, hasFile = false, hasVideo = false } = {}) {
  const text = String(prompt).toLowerCase();

  if (hasVideo || /\b(видео|ролик|фильм|кадр|монтаж)\b/.test(text)) return 'video';
  if (hasImage || /\b(фото|изображени|картинк|скриншот|что это)\b/.test(text)) return 'vision';
  if (hasFile || /\b(pdf|документ|файл|таблиц|excel|csv)\b/.test(text)) return 'documents';
  if (/\b(найди|поиск|новости|актуальн|сегодня|сейчас|интернет|сайт)\b/.test(text)) return 'web_search';
  if (/\b(купи|купить|товар|цена|магазин|ozon|озон|wildberries|wb)\b/.test(text)) return 'shopping';
  if (/\b(код|программ|скрипт|javascript|python|html|css|github)\b/.test(text)) return 'code';

  return 'chat';
}

function getCapability(name) {
  return capabilities[name] || null;
}

module.exports = { dispatch, getCapability };
