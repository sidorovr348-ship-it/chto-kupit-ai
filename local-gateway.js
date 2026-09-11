const dotenv = require('dotenv');
for (const f of [process.env.ENV_FILE, '/root/my-ai-unified/.local-ai.env', '/root/chto-kupit-ai.env']) {
  if (f) dotenv.config({ path: f, override: false });
}
const express = require('express');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const app = express();
const PORT = Number(process.env.PORT || 3020);
const TTS_VOICE = process.env.TTS_VOICE || 'ru-RU-DmitryNeural';
const TEXT_MODEL = process.env.DEEPSEEK_TEXT_MODEL || 'deepseek-v4-flash';
const VISION_MODEL = process.env.DEEPSEEK_VISION_MODEL || 'deepseek-v4-flash-vision-exp';
const HF_MODEL = process.env.HF_TEXT_MODEL || 'openai/gpt-oss-120b:fastest';
const HF_VISION_MODEL = process.env.HF_VISION_MODEL || 'Qwen/Qwen2.5-VL-72B-Instruct';
app.use(express.json({ limit: '35mb' }));
try { app.use(require('cors')()); } catch {}
process.on('uncaughtException', e => console.error('UNCAUGHT_EXCEPTION:', e?.stack || e));
process.on('unhandledRejection', e => console.error('UNHANDLED_REJECTION:', e?.stack || e));
function normalize(v) {
  const map = {'с':'c','С':'C','а':'a','А':'A','е':'e','Е':'E','о':'o','О':'O','р':'p','Р':'P','х':'x','Х':'X','у':'y','У':'Y','к':'k','К':'K','м':'m','М':'M','т':'t','Т':'T','в':'b','В':'B','н':'h','Н':'H'};
  return [...String(v || '').trim()].map(c => map[c] || c).join('');
}
function deepseekKey() {
  const v = normalize(process.env.DEEPSEEK_API_KEY);
  if (!v || /[^\x21-\x7E]/.test(v)) throw new Error('DEEPSEEK_API_KEY is unavailable or invalid');
  return v;
}
function hfKey() {
  const v = normalize(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY);
  if (!v || /[^\x21-\x7E]/.test(v)) throw new Error('Hugging Face token unavailable');
  return v;
}
function clean(v) {
  const s = String(v || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!s) throw new Error('AI provider returned empty text');
  return s;
}
function image(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(s) || /^https?:\/\//i.test(s)) return s;
  return `data:image/jpeg;base64,${s}`;
}
function textOf(messages) {
  const m = [...(Array.isArray(messages) ? messages : [])].reverse().find(x => x?.role === 'user');
  if (!m) return '';
  if (typeof m.content === 'string') return m.content;
  if (Array.isArray(m.content)) return m.content.filter(x => x?.type === 'text').map(x => x.text || '').join('\n');
  return String(m.content || '');
}
function systemPrompt() {
  return 'Ты — My AI Unified, единый русскоязычный помощник. Отвечай естественно, понятно и по делу. Не упоминай внутренние модели, ключи, серверы и техническую реализацию. Если переданы результаты поиска, используй их и давай ссылки на источники. Для покупки указывай цену, магазин, наличие и ссылку только если это есть в найденных данных.';
}
async function provider(url, apiKey, model, messages, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt() }, ...(Array.isArray(messages) ? messages : [])], temperature: 0.2, max_tokens: 1600 }),
      signal: controller.signal
    });
    const raw = await r.text();
    let d = {};
    try { d = raw ? JSON.parse(raw) : {}; } catch {}
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}: ${String(d?.error?.message || raw || '').slice(0, 500)}`), { status: r.status });
    return clean(d?.choices?.[0]?.message?.content || d?.choices?.[0]?.text);
  } finally { clearTimeout(timer); }
}
async function ask(messages, vision = false) {
  const errors = [];
  if (process.env.DEEPSEEK_API_KEY) {
    try { return { text: await provider('https://api.deepseek.com/chat/completions', deepseekKey(), vision ? VISION_MODEL : TEXT_MODEL, messages, vision ? 60000 : 30000), provider: 'deepseek', model: vision ? VISION_MODEL : TEXT_MODEL }; }
    catch (e) { errors.push(`DeepSeek: ${e.message}`); console.error('DEEPSEEK_ERROR:', e?.stack || e); }
  }
  if (process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY) {
    try { return { text: await provider('https://router.huggingface.co/v1/chat/completions', hfKey(), vision ? HF_VISION_MODEL : HF_MODEL, messages, vision ? 60000 : 30000), provider: 'huggingface', model: vision ? HF_VISION_MODEL : HF_MODEL }; }
    catch (e) { errors.push(`Hugging Face: ${e.message}`); console.error('HF_ERROR:', e?.stack || e); }
  }
  const e = new Error(errors.join(' | ') || 'No AI provider configured');
  e.status = 502;
  throw e;
}
async function searchWeb(query, shopping = false) {
  const key = normalize(process.env.SERPER_API_KEY || process.env.SERPER_KEY);
  if (!key) throw Object.assign(new Error('Поиск не настроен'), { status: 503 });
  const r = await fetch('https://google.serper.dev/search', {
    method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, gl: 'ru', hl: 'ru', num: 8 })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`Search HTTP ${r.status}`), { status: r.status });
  return (d.organic || []).slice(0, 8).map(x => ({ title: x.title, link: x.link, snippet: x.snippet })).filter(x => x.link);
}
function wantsSearch(q) {
  return /(найди|найти|где купить|купить|цена|стоимость|в наличии|магазин|сравни|актуальн|сегодня|сейчас|новост|источник|ссылк)/iu.test(q);
}
async function answerWithSearch(messages) {
  const q = textOf(messages);
  const results = await searchWeb(q, /(купить|цена|магазин|в наличии)/iu.test(q));
  const context = results.map((x, i) => `${i + 1}. ${x.title}\n${x.snippet || ''}\n${x.link}`).join('\n\n');
  const r = await ask([...messages, { role: 'user', content: `Используй найденные результаты. Дай практичный ответ на исходный запрос.\n\nРЕЗУЛЬТАТЫ ПОИСКА:\n${context}` }]);
  return { ...r, sources: results };
}
async function tts(text) {
  const EdgeTTS = require('node-edge-tts').EdgeTTS;
  const s = String(text || '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 3500);
  if (!s) throw Object.assign(new Error('text is required'), { status: 400 });
  const f = path.join(os.tmpdir(), `my-ai-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  try {
    const x = new EdgeTTS({ voice: TTS_VOICE, lang: 'ru-RU', outputFormat: 'audio-24khz-96kbitrate-mono-mp3', rate: '+0%', pitch: '+0Hz', volume: '+0%', timeout: 15000 });
    await x.ttsPromise(s, f);
    return await fs.readFile(f);
  } finally { await fs.rm(f, { force: true }).catch(() => {}); }
}
app.get('/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, service: 'my-ai-unified', dispatcher: true, adapters: { deepseek: Boolean(process.env.DEEPSEEK_API_KEY), huggingface: Boolean(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY), search: Boolean(process.env.SERPER_API_KEY || process.env.SERPER_KEY), tts: true, video: true }, capabilities: ['chat','vision','video','web_search','documents','shopping','voice','code'] });
});
app.post('/chat', async (req, res) => {
  const b = req.body || {};
  let m = Array.isArray(b.messages) && b.messages.length ? b.messages : (b.prompt ? [{ role: 'user', content: String(b.prompt) }] : []);
  if (!m.length) return res.status(400).json({ ok: false, error: 'prompt or messages is required' });
  try {
    const imgs = (Array.isArray(b.images) ? b.images : (b.image ? [b.image] : [])).map(image).filter(Boolean).slice(0, 4);
    if (imgs.length) {
      const u = [...m].reverse().find(x => x?.role === 'user');
      if (u) u.content = [{ type: 'text', text: textOf(m) || 'Проанализируй изображение подробно.' }, ...imgs.map(url => ({ type: 'image_url', image_url: { url } }))];
      const r = await ask(m, true);
      return res.json({ ok: true, route: 'vision', result: r.text, provider: r.provider, model: r.model, sources: r.sources || [] });
    }
    const q = textOf(m);
    const r = wantsSearch(q) && (process.env.SERPER_API_KEY || process.env.SERPER_KEY) ? await answerWithSearch(m) : await ask(m, false);
    return res.json({ ok: true, route: r.sources ? 'search' : 'chat', result: r.text, provider: r.provider, model: r.model, sources: r.sources || [] });
  } catch (e) { console.error('CHAT_ERROR:', e?.stack || e); return res.status(e.status || 502).json({ ok: false, error: e.message || 'AI request failed' }); }
});
app.post('/photo', async (req, res) => {
  try {
    const imgs = (Array.isArray(req.body?.images) ? req.body.images : [req.body?.image]).map(image).filter(Boolean).slice(0, 4);
    if (!imgs.length) return res.status(400).json({ ok: false, error: 'image is required' });
    const m = [{ role: 'user', content: [{ type: 'text', text: String(req.body?.prompt || 'Опиши изображение подробно. Если это товар, назови производителя, модель и видимые характеристики.') }, ...imgs.map(url => ({ type: 'image_url', image_url: { url } }))] }];
    const r = await ask(m, true);
    return res.json({ ok: true, route: 'vision', result: r.text, provider: r.provider, model: r.model });
  } catch (e) { console.error('PHOTO_ERROR:', e?.stack || e); return res.status(e.status || 502).json({ ok: false, error: e.message || 'Vision request failed' }); }
});
app.post('/search', async (req, res) => { try { const results = await searchWeb(String(req.body?.query || '')); res.json({ ok: true, results }); } catch (e) { res.status(e.status || 502).json({ ok: false, error: e.message }); } });
app.post('/shopping', async (req, res) => { try { const query = String(req.body?.query || req.body?.prompt || ''); const results = await searchWeb(`${query} купить цена в Москве в наличии`, true); res.json({ ok: true, results }); } catch (e) { res.status(e.status || 502).json({ ok: false, error: e.message }); } });
app.post('/document', async (req, res) => {
  try {
    const text = String(req.body?.text || req.body?.content || '').slice(0, 50000);
    if (!text) return res.status(400).json({ ok: false, error: 'Для этого типа файла нужен извлечённый текст' });
    const r = await ask([{ role: 'user', content: `Проанализируй содержимое документа и ответь по существу.\n\n${text}` }]);
    res.json({ ok: true, result: r.text, provider: r.provider, model: r.model });
  } catch (e) { res.status(e.status || 502).json({ ok: false, error: e.message }); }
});
app.post('/tts', async (req, res) => { try { const a = await tts(req.body?.text); res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'Content-Length': String(a.length) }); res.send(a); } catch (e) { res.status(e.status || 502).json({ ok: false, error: e.message }); } });
app.post('/alice', async (req, res) => { const c = String(req.body?.request?.command || req.body?.request?.original_utterance || '').trim(); if (!c || /^ping$/iu.test(c)) return res.json({ version: '1.0', response: { text: 'Мой AI на связи.', end_session: false } }); try { const r = await ask([{ role: 'user', content: c }]); res.json({ version: '1.0', response: { text: clean(r.text).slice(0, 1024), end_session: false } }); } catch (e) { console.error('ALICE_ERROR:', e?.stack || e); res.status(502).json({ version: '1.0', response: { text: 'Сейчас не удалось получить ответ. Попробуйте ещё раз.', end_session: false } }); } });
app.listen(PORT, '127.0.0.1', () => console.log(`My AI Unified core listening on 127.0.0.1:${PORT}`));
