require('dotenv').config({ path: process.env.ENV_FILE || '/root/chto-kupit-ai.env' });
const express = require('express');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { EdgeTTS } = require('node-edge-tts');
const { dispatch } = require('./src/dispatcher');
const { callOllama, callVision, health, OLLAMA_MODEL } = require('./src/local-ai');

const app = express();
const PORT = Number(process.env.PORT || 3020);
const LEGACY_URL = process.env.LEGACY_URL || 'http://127.0.0.1:3021';
const PARALON_BASE_URL = process.env.PARALON_BASE_URL || 'https://paraloncloud.com/v1';
const PARALON_MODEL = process.env.PARALON_MODEL || 'qwen3.8-27b';
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';
const TTS_VOICE = process.env.TTS_VOICE || 'ru-RU-DmitryNeural';
app.use(express.json({ limit: '35mb' }));
app.use(require('cors')());

process.on('uncaughtException', error => console.error('UNCAUGHT_EXCEPTION:', error?.stack || error));
process.on('unhandledRejection', error => console.error('UNHANDLED_REJECTION:', error?.stack || error));

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

function cleanAiText(value) {
  const text = String(value || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!text || /^<!doctype html/i.test(text) || /^<html/i.test(text)) throw new Error('AI provider returned invalid text');
  return text;
}

async function callOpenRouter(messages, images = []) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not configured');
  const safeMessages = [{ role: 'system', content: 'Ты My AI Unified. Отвечай по-русски, естественно, точно и кратко. Не называй внутренние модели и сервисы.' }, ...(Array.isArray(messages) ? messages : [])];
  const encoded = (Array.isArray(images) ? images : []).map(normalizeVisionImage).filter(Boolean).slice(0, 4);
  if (encoded.length) {
    const lastUser = [...safeMessages].reverse().find(m => m?.role === 'user');
    if (lastUser) {
      const text = typeof lastUser.content === 'string' ? lastUser.content : textFromMessages([lastUser]);
      lastUser.content = [{ type: 'text', text: text || 'Проанализируй изображения подробно.' }, ...encoded.map(url => ({ type: 'image_url', image_url: { url } }))];
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_PUBLIC_URL || 'https://aliceq.ru',
        'X-Title': 'My AI Unified'
      },
      body: JSON.stringify({ model: OPENROUTER_MODEL, messages: safeMessages, temperature: 0.2 }),
      signal: controller.signal
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}`);
    return cleanAiText(data?.choices?.[0]?.message?.content);
  } finally { clearTimeout(timer); }
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
    return cleanAiText(data?.choices?.[0]?.message?.content);
  } finally { clearTimeout(timer); }
}

function normalizeVisionImage(image) {
  const value = String(image || '').trim();
  if (!value) return '';
  if (/^(data:image\/(png|jpe?g|webp|gif);base64,|https?:\/\/)/i.test(value)) return value;
  return `data:image/jpeg;base64,${value.replace(/^data:/i, '')}`;
}

async function callParalonVision(prompt, images) {
  if (!process.env.PARALON_API_KEY) throw new Error('PARALON_API_KEY is not configured');
  const encoded = (Array.isArray(images) ? images : []).map(normalizeVisionImage).filter(Boolean).slice(0, 2);
  if (!encoded.length) throw Object.assign(new Error('image is required'), { status: 400 });
  const content = [
    { type: 'text', text: String(prompt || 'Проанализируй изображение подробно. Определи, что на нём изображено, прочитай видимый текст и укажи важные детали.') },
    ...encoded.map(url => ({ type: 'image_url', image_url: { url } }))
  ];
  const safe = [{ role: 'system', content: 'Ты — визуальный модуль My AI Unified. Отвечай по-русски. Внимательно анализируй изображения, не выдумывай то, чего не видно. Если это товар, по возможности назови производителя, модель, тип и видимые характеристики.' }, { role: 'user', content }];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
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
    if (!response.ok) throw new Error(`Paralon vision HTTP ${response.status}`);
    return cleanAiText(data?.choices?.[0]?.message?.content);
  } finally { clearTimeout(timer); }
}

async function answerForChat(chatMessages, userPrompt, route) {
  if (route === 'chat' || route === 'code') {
    try { return { result: await callOpenRouter(chatMessages), model: OPENROUTER_MODEL, local: false, fallback: false, provider: 'openrouter' }; }
    catch (e) { console.warn('OpenRouter unavailable:', e.message); }
    try { return { result: await callParalon(chatMessages), model: PARALON_MODEL, local: false, fallback: true, provider: 'paralon' }; }
    catch (e) { console.warn('Paralon unavailable:', e.message); }
    try { return { result: await callOllama(chatMessages, { timeoutMs: 4500, numPredict: route === 'code' ? 900 : 180 }), model: OLLAMA_MODEL, local: true, fallback: true, provider: 'ollama' }; }
    catch (e) { console.warn('Local AI unavailable:', e.message); }
  }
  return null;
}

async function synthesizeSpeech(text) {
  const clean = String(text || '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 3500);
  if (!clean) throw Object.assign(new Error('text is required'), { status: 400 });
  const file = path.join(os.tmpdir(), `my-ai-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  try {
    const tts = new EdgeTTS({ voice: TTS_VOICE, lang: 'ru-RU', outputFormat: 'audio-24khz-96kbitrate-mono-mp3', rate: '+0%', pitch: '+0Hz', volume: '+0%', timeout: 15000 });
    await tts.ttsPromise(clean, file);
    return await fs.readFile(file);
  } finally { await fs.rm(file, { force: true }).catch(() => {}); }
}

app.get('/health', async (req, res) => {
  const local = await health();
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, service: 'my-ai-unified', dispatcher: true, local_ai: local, adapters: { local: local.ok, ollama: local.ok, paralon: Boolean(process.env.PARALON_API_KEY), openrouter: Boolean(process.env.OPENROUTER_API_KEY), tts: true, video: true, shopping: true }, capabilities: ['chat','vision','image_generation','video','web_search','documents','tables','shopping','voice','code','verification'] });
});

app.post('/tts', async (req, res) => {
  try { const audio = await synthesizeSpeech(req.body?.text); res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'Content-Length': String(audio.length) }); return res.send(audio); }
  catch (error) { return res.status(error.status || 502).json({ ok: false, error: error.message }); }
});

app.post('/chat', async (req, res) => {
  try {
    const { prompt = '', messages, hasImage = false, hasFile = false, hasVideo = false } = req.body || {};
    const chatMessages = Array.isArray(messages) && messages.length ? messages : (prompt ? [{ role: 'user', content: prompt }] : []);
    const userPrompt = String(prompt || textFromMessages(chatMessages)).trim();
    if (!userPrompt && !chatMessages.length) return res.status(400).json({ ok: false, error: 'prompt or messages is required' });
    const route = dispatch({ prompt: userPrompt, hasImage, hasFile, hasVideo });
    const answer = await answerForChat(chatMessages, userPrompt, route);
    if (answer) return res.json({ ok: true, route, ...answer });
    if (route === 'vision' && req.body?.image) {
      try { return res.json({ ok: true, route, result: await callOpenRouter([{ role: 'user', content: userPrompt || 'Проанализируй изображение.' }], [req.body.image]), model: OPENROUTER_MODEL, local: false, provider: 'openrouter' }); }
      catch (e) { console.warn('OpenRouter vision unavailable:', e.message); }
      try { return res.json({ ok: true, route, result: await callParalonVision(userPrompt || 'Проанализируй изображение.', [req.body.image]), model: PARALON_MODEL, local: false, fallback: true, provider: 'paralon' }); }
      catch (e) { console.warn('Paralon vision unavailable:', e.message); }
      try { return res.json({ ok: true, route, result: await callVision(userPrompt || 'Проанализируй изображение.', [req.body.image]), model: OLLAMA_MODEL, local: true, fallback: true, provider: 'ollama' }); }
      catch (e) { console.warn('Local vision unavailable:', e.message); }
    }
    return proxy(req, res, 30000);
  } catch (error) { return res.status(error.status || 502).json({ ok: false, error: error.message, details: error.details }); }
});

app.post('/photo', async (req, res) => {
  try {
    const images = Array.isArray(req.body?.images) ? req.body.images : (req.body?.image ? [req.body.image] : []);
    try { return res.json({ ok: true, route: 'vision', result: await callOpenRouter([{ role: 'user', content: req.body?.prompt || 'Опиши изображения подробно.' }], images), model: OPENROUTER_MODEL, local: false, provider: 'openrouter' }); }
    catch (e) { console.warn('OpenRouter photo vision unavailable:', e.message); }
    try { return res.json({ ok: true, route: 'vision', result: await callParalonVision(req.body?.prompt || 'Опиши изображение подробно.', images), model: PARALON_MODEL, local: false, fallback: true, provider: 'paralon' }); }
    catch (e) { console.warn('Paralon photo vision unavailable:', e.message); }
    try { return res.json({ ok: true, route: 'vision', result: await callVision(req.body?.prompt || 'Опиши изображение подробно.', images), model: OLLAMA_MODEL, local: true, fallback: true, provider: 'ollama' }); }
    catch (e) { console.warn('Local photo vision unavailable:', e.message); }
    return proxy(req, res, 60000);
  } catch (error) { return res.status(error.status || 502).json({ ok: false, error: error.message, details: error.details }); }
});

app.post('/alice', async (req, res) => {
  const command = String(req.body?.request?.command || req.body?.request?.original_utterance || '').trim();
  const sessionId = String(req.body?.session?.session_id || 'default');
  if (!command || /^ping$/iu.test(command)) return res.json({ version: '1.0', response: { text: 'Мой AI на связи.', end_session: false } });
  try {
    const route = dispatch({ prompt: command, hasImage: false, hasFile: false, hasVideo: false });
    const answer = await answerForChat([{ role: 'user', content: command }], command, route || 'chat');
    if (answer?.result) {
      const text = String(answer.result).replace(/<think>[\s\S]*?<\/think>/gi, '').trim().slice(0, 1024) || 'Я готов продолжать.';
      return res.json({ version: '1.0', response: { text, end_session: false }, session_state: { session_id: sessionId, unified: true, route, local: answer.local, fallback: Boolean(answer.fallback), model: answer.model, provider: answer.provider } });
    }
    throw new Error('central dispatcher returned no answer');
  } catch (error) {
    console.warn('Alice central answer failed:', error.message);
    const quick = /кто тебя создал/iu.test(command) ? 'Меня создал Roman.' : /как тебя зовут/iu.test(command) ? 'Мой AI.' : 'Я получил запрос, но AI сейчас недоступен. Повтори вопрос.';
    return res.json({ version: '1.0', response: { text: quick, end_session: false }, session_state: { session_id: sessionId, unified: false, fallback: true, error: 'ai_unavailable' } });
  }
});

app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/chat' || req.path === '/photo' || req.path === '/tts' || req.path === '/alice') return next();
  proxy(req, res);
});

app.listen(PORT, '127.0.0.1', () => console.log(`My AI Unified local gateway on 127.0.0.1:${PORT}; primary=openrouter:${OPENROUTER_MODEL}; secondary=${PARALON_MODEL}; local-fallback=${OLLAMA_MODEL}; tts=${TTS_VOICE}`));
