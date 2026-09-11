const fs = require('fs');
const path = process.argv[2] || 'local-gateway.js';
let s = fs.readFileSync(path, 'utf8');

if (!s.includes("const DEEPSEEK_BASE_URL")) {
  s = s.replace(
    "const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';",
    "const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';\nconst DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';\nconst DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';\nconst DEEPSEEK_VISION_MODEL = process.env.DEEPSEEK_VISION_MODEL || 'deepseek-v4-flash-vision-exp';"
  );
}

if (!s.includes('async function callDeepSeek(')) {
  const marker = '\nasync function callOpenRouter(messages, images = []) {';
  const fn = `
async function callDeepSeek(messages, images = []) {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY is not configured');
  const safeMessages = [{ role: 'system', content: 'Ты My AI Unified. Отвечай по-русски, естественно, точно и кратко. Не называй внутренние модели и сервисы.' }, ...(Array.isArray(messages) ? messages : [])];
  const encoded = (Array.isArray(images) ? images : []).map(normalizeVisionImage).filter(Boolean).slice(0, 4);
  if (encoded.length) {
    const lastUser = [...safeMessages].reverse().find(m => m?.role === 'user');
    if (!lastUser) throw new Error('user message is required for vision');
    const text = typeof lastUser.content === 'string' ? lastUser.content : textFromMessages([lastUser]);
    lastUser.content = [{ type: 'text', text: text || 'Проанализируй изображения подробно.' }, ...encoded.map(url => ({ type: 'image_url', image_url: { url, detail: 'auto' } }))];
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), encoded.length ? 90000 : 60000);
  try {
    const response = await fetch(DEEPSEEK_BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.DEEPSEEK_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: encoded.length ? DEEPSEEK_VISION_MODEL : DEEPSEEK_MODEL, messages: safeMessages, thinking: { type: 'disabled' }, temperature: 0.2 }),
      signal: controller.signal
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!response.ok) throw new Error('DeepSeek HTTP ' + response.status);
    return cleanAiText(data?.choices?.[0]?.message?.content);
  } finally { clearTimeout(timer); }
}
`;
  s = s.replace(marker, fn + marker);
}

const start = s.indexOf('async function answerForChat(');
const end = s.indexOf('\nasync function synthesizeSpeech(', start);
if (start < 0 || end < 0) throw new Error('answerForChat markers not found');
const answerFn = `async function answerForChat(chatMessages, userPrompt, route) {
  if (route === 'chat' || route === 'code') {
    try { return { result: await callDeepSeek(chatMessages), model: DEEPSEEK_MODEL, local: false, fallback: false, provider: 'deepseek' }; }
    catch (e) { console.warn('DeepSeek unavailable:', e.message); }
    try { return { result: await callParalon(chatMessages), model: PARALON_MODEL, local: false, fallback: true, provider: 'paralon' }; }
    catch (e) { console.warn('Paralon unavailable:', e.message); }
    try { return { result: await callOllama(chatMessages, { timeoutMs: 60000, numPredict: route === 'code' ? 900 : 180 }), model: OLLAMA_MODEL, local: true, fallback: true, provider: 'ollama' }; }
    catch (e) { console.warn('Local AI unavailable:', e.message); }
  }
  return null;
}
`;
s = s.slice(0, start) + answerFn + s.slice(end);

s = s.replace(
  "adapters: { local: local.ok, ollama: local.ok, paralon: Boolean(process.env.PARALON_API_KEY), openrouter: Boolean(process.env.OPENROUTER_API_KEY),",
  "adapters: { local: local.ok, ollama: local.ok, deepseek: Boolean(process.env.DEEPSEEK_API_KEY), paralon: Boolean(process.env.PARALON_API_KEY), openrouter: Boolean(process.env.OPENROUTER_API_KEY),"
);

const visionChatOld = `      try { return res.json({ ok: true, route, result: await callOpenRouter([{ role: 'user', content: userPrompt || 'Проанализируй изображение.' }], [req.body.image]), model: OPENROUTER_MODEL, local: false, provider: 'openrouter' }); }
      catch (e) { console.warn('OpenRouter vision unavailable:', e.message); }`;
const visionChatNew = `      try { return res.json({ ok: true, route, result: await callDeepSeek([{ role: 'user', content: userPrompt || 'Проанализируй изображение.' }], [req.body.image]), model: DEEPSEEK_VISION_MODEL, local: false, provider: 'deepseek' }); }
      catch (e) { console.warn('DeepSeek vision unavailable:', e.message); }`;
s = s.replace(visionChatOld, visionChatNew);

const photoOld = `    try { return res.json({ ok: true, route: 'vision', result: await callOpenRouter([{ role: 'user', content: req.body?.prompt || 'Опиши изображения подробно.' }], images), model: OPENROUTER_MODEL, local: false, provider: 'openrouter' }); }
    catch (e) { console.warn('OpenRouter photo vision unavailable:', e.message); }`;
const photoNew = `    try { return res.json({ ok: true, route: 'vision', result: await callDeepSeek([{ role: 'user', content: req.body?.prompt || 'Опиши изображения подробно.' }], images), model: DEEPSEEK_VISION_MODEL, local: false, provider: 'deepseek' }); }
    catch (e) { console.warn('DeepSeek photo vision unavailable:', e.message); }`;
s = s.replace(photoOld, photoNew);

fs.writeFileSync(path, s);
console.log('DEEPSEEK_PATCH_OK');
