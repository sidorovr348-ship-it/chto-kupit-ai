const capabilities = require('./capabilities.json');

function dispatch({ prompt = '', hasImage = false, hasFile = false, hasVideo = false } = {}) {
  const text = String(prompt).toLowerCase();

  if (hasVideo || /(видео|ролик|фильм|кадр|монтаж)/u.test(text)) return 'video';
  if (hasImage || /(фото|изображени|картинк|скриншот|что это)/u.test(text)) return 'vision';
  if (hasFile || /(pdf|документ|файл|таблиц|excel|csv)/u.test(text)) return 'documents';
  if (/(купи|купить|товар|цена|магазин|ozon|озон|wildberries|wb)/u.test(text)) return 'shopping';
  if (/(найди|поиск|новости|актуальн|сегодня|сейчас|интернет|сайт)/u.test(text)) return 'web_search';
  if (/(код|программ|скрипт|javascript|python|html|css|github)/u.test(text)) return 'code';

  return 'chat';
}

function getCapability(name) {
  return capabilities[name] || null;
}

module.exports = { dispatch, getCapability };
