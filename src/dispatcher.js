const capabilities = require('./capabilities.json');

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function dispatch({ prompt = '', hasImage = false, hasFile = false, hasVideo = false } = {}) {
  const text = String(prompt).toLowerCase().trim();

  if (hasVideo || hasAny(text, [/(видео|ролик|фильм|кадр|монтаж|видеозапис)/u])) return 'video';

  // Image generation must be checked before generic image/vision words such as «картинка».
  if (hasAny(text, [/(нарисуй|сгенерируй.*(изображение|картинк|фото)|создай.*(изображение|картинк|фото)|сделай.*(картинк|изображение|фото))/u])) return 'image_generation';
  if (hasImage || hasAny(text, [/(фото|изображени|картинк|скриншот|что это на фото|посмотри на)/u])) return 'vision';

  if (hasFile || hasAny(text, [/(pdf|документ|файл|docx?|текстовый файл)/u])) return 'documents';
  if (hasAny(text, [/(таблиц|excel|xlsx|csv|диаграмм|график.*данн|данные.*таблиц)/u])) return 'tables';

  if (hasAny(text, [/(диагност|системн.*ошибк|сервер.*не работает|сайт.*не работает|проблем.*с приложением|сломалось|сломался|не работает)/u])) return 'verification';

  // Shopping (товары) has priority over generic web search when the user clearly asks about buying.
  if (hasAny(text, [/(купи|купить|товар|цена|магазин|ozon|озон|wildberries|wb|яндекс.?маркет|dns|м\.видео|ситилинк|в наличии|дешевле|где купить|стоимость|сравни.*(цен|товар)|найди\s+(мне\s+)?(?:iphone|айфон|телефон|смартфон|телевизор|стиральн|ноутбук|карниз|товар))/u])) return 'shopping';

  if (hasAny(text, [/(найди|поиск|новости|актуальн|сегодня|сейчас|интернет|сайт|последн.*информац|свеж.*информац)/u])) return 'web_search';
  if (hasAny(text, [/(код|программ|скрипт|javascript|python|html|css|github|ошибк.*в коде|проверь.*код)/u])) return 'code';

  return 'chat';
}

function getCapability(name) {
  return capabilities[name] || null;
}

module.exports = { dispatch, getCapability };
