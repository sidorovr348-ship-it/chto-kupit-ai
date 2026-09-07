require('dotenv').config({ path: process.env.ENV_FILE || '/root/chto-kupit-ai.env' });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { dispatch, getCapability } = require('./src/dispatcher');

const app = express();
const PORT = Number(process.env.PORT || 3020);
const PARALON_BASE_URL = process.env.PARALON_BASE_URL || 'https://paraloncloud.com/v1';
const PARALON_MODEL = process.env.PARALON_MODEL || 'qwen3.8-27b';
const MEDIA_ROOT = process.env.VERCEL ? '/tmp/my-ai-unified-media' : path.join(__dirname, 'media');
const INPUT_DIR = path.join(MEDIA_ROOT, 'input');
const TEMP_DIR = path.join(MEDIA_ROOT, 'temp');
for (const dir of [INPUT_DIR, TEMP_DIR]) fs.mkdirSync(dir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(__dirname));

const SYSTEM_PROMPT = `Ты — My AI Unified, единый универсальный AI-помощник пользователя. Отвечай на русском, если пользователь пишет по-русски. Не называй себя ChatGPT и не утверждай, что ты создан OpenAI. Не называй себя Qwen или Paralon: это внутренние технологии, через которые может работать My AI Unified. Если пользователь спрашивает «кто ты?», «как тебя зовут?» или аналогично, отвечай: «Я — My AI Unified, единый AI-помощник. Я умею общаться, искать информацию, анализировать фото и документы, работать с товарами, кодом и другими задачами.» Будь полезным, точным и честным; не выдумывай выполненные действия.`;

function configured(name) {
  if (name === 'paralon') return Boolean(process.env.PARALON_API_KEY);
  if (name === 'serper') return Boolean(process.env.SERPER_API_KEY);
  return false;
}

function textFromMessages(messages) {
  const last = [...messages].reverse().find(m => m && m.role === 'user');
  if (!last) return '';
  if (typeof last.content === 'string') return last.content;
  if (Array.isArray(last.content)) {
    return last.content.filter(x => x?.type === 'text').map(x => x.text || '').join('\n');
  }
  return String(last.content || '');
}

function withSystemPrompt(messages) {
  const clean = Array.isArray(messages) ? messages.filter(m => m?.role !== 'system') : [];
  return [{ role: 'system', content: SYSTEM_PROMPT }, ...clean];
}

async function callEmergencyTextFallback(messages) {
  const prompt = `${SYSTEM_PROMPT}\n\nПользователь:\n${textFromMessages(messages)}`;
  if (!textFromMessages(messages)) throw Object.assign(new Error('Пустой запрос'), { status: 400 });
  const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`;
  const response = await fetch(url, { method: 'GET', headers: { Accept: 'text/plain' } });
  const text = await response.text();
  if (!response.ok || !text.trim()) {
    const error = new Error('Emergency AI fallback failed');
    error.status = response.status || 502;
    error.details = text.slice(0, 500);
    throw error;
  }
  return text.trim();
}

async function callParalon(messages) {
  const safeMessages = withSystemPrompt(messages);
  if (!configured('paralon')) {
    console.warn('PARALON_API_KEY missing; using emergency text AI fallback');
    return callEmergencyTextFallback(safeMessages);
  }
  const response = await fetch(`${PARALON_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.PARALON_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: PARALON_MODEL, messages: safeMessages })
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error('Paralon request failed');
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data.choices?.[0]?.message?.content || '';
}

async function searchWeb(query, location = 'Россия') {
  if (!configured('serper')) {
    const error = new Error('SERPER_API_KEY is not configured');
    error.status = 503;
    throw error;
  }
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: `${query} ${location}`, gl: 'ru', hl: 'ru', num: 10 })
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error('Web search failed');
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return Array.isArray(data.organic) ? data.organic.slice(0, 10).map(item => ({ title: item.title || '', url: item.link || '', content: item.snippet || '' })) : [];
}

async function answerFromSearch(query, results, location = 'Россия') {
  const compact = (Array.isArray(results) ? results : []).slice(0, 8).map((item, index) =>
    `[${index + 1}] ${item.title}\nURL: ${item.url}\nФрагмент: ${item.content}`
  ).join('\n\n');
  if (!compact) return 'Поиск не вернул подходящих результатов.';

  const prompt = `Ты — My AI Unified. Пользователь попросил найти актуальную информацию в интернете. Ниже переданы результаты поиска. Сформируй нормальный человеческий ответ на русском языке, а не технический JSON. Используй только информацию из переданных результатов и не выдумывай факты. Если источники противоречат друг другу или данных недостаточно, прямо скажи об этом. Для важных утверждений указывай номер источника в квадратных скобках, например [1]. В конце добавь короткий раздел «Источники» со списком использованных источников в формате [1] Название — URL. Не говори, что ты сам открыл сайты или проверил то, чего нет в результатах поиска.\n\nЗапрос пользователя: ${query}\nРегион: ${location}\n\nРезультаты поиска:\n${compact}`;

  return callParalon([{ role: 'user', content: prompt }]);
}

async function searchShopping(query, location = 'Россия', mode = 'find') {
  if (!configured('serper')) {
    const error = new Error('SERPER_API_KEY is not configured');
    error.status = 503;
    throw error;
  }
  const q = mode === 'cheaper' ? `${query} аналог дешевле ${location}` : `${query} купить ${location}`;
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, gl: 'ru', hl: 'ru', num: 20 })
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error('Shopping search failed');
    error.status = response.status;
    error.details = data;
    throw error;
  }
  const allowed = ['ozon.ru', 'wildberries.ru', 'market.yandex.ru', 'dns-shop.ru', 'mvideo.ru', 'citilink.ru'];
  return Array.isArray(data.organic)
    ? data.organic.filter(item => allowed.some(domain => String(item.link || '').toLowerCase().includes(domain))).slice(0, 10)
        .map(item => ({ title: item.title || '', url: item.link || '', content: item.snippet || '' }))
    : [];
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stderr }));
      else resolve({ stdout, stderr });
    });
  });
}

async function extractVideoFrames(inputFile) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const frameFiles = [path.join(TEMP_DIR, `frame-${stamp}-1.jpg`), path.join(TEMP_DIR, `frame-${stamp}-2.jpg`)];
  await Promise.all([
    runFfmpeg(['-y', '-ss', '0.6', '-i', inputFile, '-frames:v', '1', '-vf', 'scale=320:180', '-q:v', '6', frameFiles[0]]),
    runFfmpeg(['-y', '-ss', '5.4', '-i', inputFile, '-frames:v', '1', '-vf', 'scale=320:180', '-q:v', '6', frameFiles[1]])
  ]);
  return frameFiles.filter(file => fs.existsSync(file));
}

async function analyzeVideo(images) {
  const content = [{ type: 'text', text: 'Проанализируй видео по выбранным кадрам. Опиши, что происходит, какие объекты и действия видны, и укажи важные детали.' }];
  for (const image of images) content.push({ type: 'image_url', image_url: { url: image } });
  return callParalon([{ role: 'user', content }]);
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'my-ai-unified', dispatcher: true, adapters: { paralon: configured('paralon'), paralon_fallback: true, serper: configured('serper'), video: true }, capabilities: Object.keys({ chat: getCapability('chat'), vision: getCapability('vision'), image_generation: getCapability('image_generation'), video: getCapability('video'), web_search: getCapability('web_search'), documents: getCapability('documents'), tables: getCapability('tables'), shopping: getCapability('shopping'), voice: getCapability('voice'), code: getCapability('code'), verification: getCapability('verification') }) });
});

app.post('/chat', async (req, res) => {
  try {
    const { prompt = '', messages, hasImage = false, hasFile = false, hasVideo = false, location = 'Россия' } = req.body || {};
    const chatMessages = Array.isArray(messages) && messages.length ? messages : (prompt ? [{ role: 'user', content: prompt }] : []);
    const userPrompt = String(prompt || textFromMessages(chatMessages)).trim();
    if (!userPrompt && !chatMessages.length) return res.status(400).json({ ok: false, error: 'prompt or messages is required' });
    const route = dispatch({ prompt: userPrompt, hasImage, hasFile, hasVideo });
    if (route === 'shopping') return res.json({ ok: true, route, results: await searchShopping(userPrompt, location, 'find') });
    if (route === 'web_search') {
      const results = await searchWeb(userPrompt, location);
      const result = await answerFromSearch(userPrompt, results, location);
      return res.json({ ok: true, route, result, sources: results.slice(0, 8).map(item => ({ title: item.title, url: item.url })) , model: PARALON_MODEL });
    }
    if (route === 'code') return res.json({ ok: true, route, result: await callParalon(chatMessages), model: PARALON_MODEL });
    if (route === 'video') return res.json({ ok: true, route, status: 'routed', message: 'Задача передана модулю видео.' });
    if (route === 'documents') return res.json({ ok: true, route, status: 'routed', message: 'Задача передана модулю документов.' });
    if (route !== 'chat') return res.json({ ok: true, route, status: 'routed', message: `Задача передана модулю: ${route}.` });
    res.json({ ok: true, route, result: await callParalon(chatMessages), model: configured('paralon') ? PARALON_MODEL : 'emergency-text-fallback' });
  } catch (error) {
    console.error('CHAT ERROR:', error);
    res.status(error.status || 500).json({ ok: false, error: error.message || 'AI request failed', details: error.details || undefined });
  }
});

app.post('/photo', async (req, res) => {
  try {
    const { prompt = 'Опиши изображение подробно.', image, images } = req.body || {};
    const inputImages = Array.isArray(images) ? images : (image ? [image] : []);
    if (!inputImages.length) return res.status(400).json({ ok: false, error: 'image or images is required' });
    if (!configured('paralon')) return res.status(503).json({ ok: false, error: 'Для анализа фото сейчас нужен основной AI-ключ Paralon; аварийный текстовый режим работает для обычного чата.' });
    const content = [{ type: 'text', text: prompt }];
    for (const item of inputImages) {
      const imageData = String(item).startsWith('data:') ? item : `data:image/jpeg;base64,${item}`;
      content.push({ type: 'image_url', image_url: { url: imageData } });
    }
    res.json({ ok: true, route: 'vision', result: await callParalon([{ role: 'user', content }]), model: PARALON_MODEL });
  } catch (error) {
    console.error('PHOTO ERROR:', error);
    res.status(error.status || 500).json({ ok: false, error: error.message || 'Vision request failed' });
  }
});

app.post('/video', async (req, res) => {
  let inputFile = null;
  let frameFiles = [];
  try {
    const raw = String(req.body?.video || req.body?.data || '');
    if (!raw) return res.status(400).json({ ok: false, error: 'video or data is required' });
    const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
    inputFile = path.join(TEMP_DIR, `video-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
    fs.writeFileSync(inputFile, Buffer.from(base64, 'base64'));
    frameFiles = await extractVideoFrames(inputFile);
    if (!frameFiles.length) return res.status(502).json({ ok: false, error: 'Не удалось извлечь кадры видео' });
    const images = frameFiles.map(file => `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`);
    res.json({ ok: true, route: 'video', result: await analyzeVideo(images), frames: images.length, model: PARALON_MODEL });
  } catch (error) {
    console.error('VIDEO ERROR:', error);
    res.status(error.status || 502).json({ ok: false, error: error.message || 'Ошибка обработки видео' });
  } finally {
    if (inputFile) { try { fs.unlinkSync(inputFile); } catch {} }
    for (const file of frameFiles) { try { fs.unlinkSync(file); } catch {} }
  }
});

app.post('/shopping', async (req, res) => {
  try {
    const { query, location = 'Россия', mode = 'find' } = req.body || {};
    if (!query) return res.status(400).json({ ok: false, error: 'query is required' });
    res.json({ ok: true, route: 'shopping', mode, location, results: await searchShopping(query, location, mode) });
  } catch (error) {
    console.error('SHOPPING ERROR:', error);
    res.status(error.status || 500).json({ ok: false, error: error.message || 'Shopping request failed', details: error.details || undefined });
  }
});

app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

if (!process.env.VERCEL) {
  app.listen(PORT, '127.0.0.1', () => console.log(`My AI Unified API started on 127.0.0.1:${PORT}`));
}

module.exports = app;

// Vercel redeploy checkpoint: emergency text fallback added while Paralon env access is repaired.
