require('dotenv').config({ path: process.env.ENV_FILE || '/root/chto-kupit-ai.env' });
const express = require('express');
const { dispatch } = require('./src/dispatcher');
const { callOllama, callVision, health, OLLAMA_MODEL } = require('./src/local-ai');

const app = express();
const PORT = Number(process.env.PORT || 3020);
const LEGACY_URL = process.env.LEGACY_URL || 'http://127.0.0.1:3021';
const PARALON_BASE_URL = process.env.PARALON_BASE_URL || 'https://paraloncloud.com/v1';
const PARALON_MODEL = process.env.PARALON_MODEL || 'qwen3.8-27b';
app.use(express.json({ limit: '35mb' }));
app.use(require('cors')());

function textFromMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const last = [...list].reverse().find(m => m?.role === 'user');
  if (!last) return '';
  if (typeof last.content === 'string') return last.content;
  if (Array.isArray(last.content)) return last.content.filter(x => x?.type === 'text').map(x => x.text || '').join('\n');
  return String(last.content || '');
}

async function proxy(req, res, timeoutMs = 30000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${LEGACY_URL}${req.originalUrl}`, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body || {}),
      signal: controller.signal
    });
    clearTimeout(timer);
    const text = await response.text();
    res.status(response.status).type(response.headers.get('content-type') || 'application/json').send(text);
  } catch (error) {
    res.status(502).json({ ok: false, error: 'Legacy module unavailable', details: error.message });
  }
}

async function callParalon(messages) {
  if (!process.env.PARALON_API_KEY) throw new Error('PARALON_API_KEY is not configured');
  const safe = [{ role: 'system', content: 'Ты My AI Unified. Отвечай по-русски, естественно, точно и кратко. Не называй внутренние модели и сервисы.' }, ...(Array.isArray(messages) ? messages : [])];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${PARALON_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PARALON_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: PARALON_MODEL, messages: safe }),
      signal: controller.signal
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!response.ok) throw new Error(`Paralon HTTP ${response.status}`);
    const result = data?.choices?.[0]?.message?.content;
    if (!result) throw new Error('Paralon returned empty response');
    return String(result).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  } finally { clearTimeout(timer); }
}

async function callFastRemote(prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const url = new URL('https://text.pollinations.ai/');
    url.searchParams.set('model', 'openai');
    url.searchParams.set('system', 'Отвечай по-русски кратко и естественно. Ты My AI Unified.');
    url.searchParams.set('prompt', prompt);
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`remote HTTP ${response.status}`);
    const text = (await response.text()).trim();
    if (!text) throw new Error('remote AI returned empty response');
    return text;
  } finally { clearTimeout(timer); }
}

app.get('/health', async (req, res) => {
  const local = await health();
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, service: 'my-ai-unified', dispatcher: true, local_ai: local, adapters: { local: local.ok, ollama: local.ok, paralon: Boolean(process.env.PARALON_API_KEY), video: true, shopping: true }, capabilities: ['chat','vision','image_generation','video','web_search','documents','tables','shopping','voice','code','verification'] });
});

app.post('/chat', async (req, res) => {
  try {
    const { prompt = '', messages, hasImage = false, hasFile = false, hasVideo = false } = req.body || {};
    const chatMessages = Array.isArray(messages) && messages.length ? messages : (prompt ? [{ role: 'user', content: prompt }] : []);
    const userPrompt = String(prompt || textFromMessages(chatMessages)).trim();
    if (!userPrompt && !chatMessages.length) return res.status(400).json({ ok: false, error: 'prompt or messages is required' });
    const route = dispatch({ prompt: userPrompt, hasImage, hasFile, hasVideo });
    if (route === 'chat' || route === 'code') {
      try {
        const answer = await callOllama(chatMessages, { timeoutMs: 4500, numPredict: route === 'code' ? 900 : 180 });
        return res.json({ ok: true, route, result: answer, model: OLLAMA_MODEL, local: true });
      } catch (localError) { console.warn('Local AI unavailable:', localError.message); }
      try {
        const answer = await callParalon(chatMessages);
        return res.json({ ok: true, route, result: answer, model: PARALON_MODEL, local: false, fallback: true });
      } catch (paralonError) { console.warn('Paralon unavailable:', paralonError.message); }
      try {
        const answer = await callFastRemote(userPrompt);
        return res.json({ ok: true, route, result: answer, model: 'pollinations-openai', local: false, fallback: true });
      } catch (remoteError) { console.warn('Fast remote AI unavailable:', remoteError.message); }
      return proxy(req, res, 30000);
    }
    if (route === 'vision' && req.body?.image) {
      try {
        const answer = await callVision(userPrompt || 'Проанализируй изображение.', [req.body.image]);
        return res.json({ ok: true, route, result: answer, model: OLLAMA_MODEL, local: true });
      } catch (localError) { console.warn('Local vision unavailable:', localError.message); }
      return proxy(req, res, 60000);
    }
    return proxy(req, res, 30000);
  } catch (error) { return res.status(error.status || 502).json({ ok: false, error: error.message, details: error.details }); }
});

app.post('/photo', async (req, res) => {
  try {
    const images = Array.isArray(req.body?.images) ? req.body.images : (req.body?.image ? [req.body.image] : []);
    try {
      const answer = await callVision(req.body?.prompt || 'Опиши изображение подробно.', images);
      return res.json({ ok: true, route: 'vision', result: answer, model: OLLAMA_MODEL, local: true });
    } catch (localError) { console.warn('Local photo vision unavailable:', localError.message); }
    return proxy(req, res, 60000);
  } catch (error) { return res.status(error.status || 502).json({ ok: false, error: error.message, details: error.details }); }
});

app.post('/alice', async (req, res) => {
  const command = String(req.body?.request?.command || req.body?.request?.original_utterance || '').trim();
  const sessionId = String(req.body?.session?.session_id || 'default');
  if (!command || /^ping$/iu.test(command)) return res.json({ version: '1.0', response: { text: 'Мой AI на связи.', end_session: false } });
  try {
    const answer = await callOllama([{ role: 'user', content: command }], { timeoutMs: 3900, numPredict: 220 });
    const text = String(answer || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim().slice(0, 1024) || 'Я готов продолжать.';
    return res.json({ version: '1.0', response: { text, end_session: false }, session_state: { session_id: sessionId, local: true, model: OLLAMA_MODEL } });
  } catch (error) {
    try {
      const text = (await callParalon([{ role: 'user', content: command }])).slice(0, 1024);
      return res.json({ version: '1.0', response: { text, end_session: false }, session_state: { session_id: sessionId, local: false, fallback: true, model: PARALON_MODEL } });
    } catch (paralonError) {
      try {
        const text = (await callFastRemote(command)).slice(0, 1024);
        return res.json({ version: '1.0', response: { text, end_session: false }, session_state: { session_id: sessionId, local: false, fallback: true, model: 'pollinations-openai' } });
      } catch {
        const quick = /кто тебя создал/iu.test(command) ? 'Меня создал Roman.' : /как тебя зовут/iu.test(command) ? 'Мой AI.' : 'Я получил запрос, но AI сейчас недоступен. Повтори вопрос.';
        return res.json({ version: '1.0', response: { text: quick, end_session: false }, session_state: { session_id: sessionId, local: false, fallback: true } });
      }
    }
  }
});

app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/chat' || req.path === '/photo' || req.path === '/alice') return next();
  proxy(req, res);
});

app.listen(PORT, '127.0.0.1', () => console.log(`My AI Unified local gateway on 127.0.0.1:${PORT}; model=${OLLAMA_MODEL}`));
