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

function configured(name) {
  if (name === 'paralon') return Boolean(process.env.PARALON_API_KEY);
  if (name === 'serper') return Boolean(process.env.SERPER_API_KEY);
  return false;
}

async function callParalon(messages) {
  if (!configured('paralon')) {
    const error = new Error('PARALON_API_KEY is not configured');
    error.status = 503;
    throw error;
  }
  const response = await fetch(`${PARALON_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.PARALON_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: PARALON_MODEL, messages })
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
  res.json({ ok: true, service: 'my-ai-unified', dispatcher: true, adapters: { paralon: configured('paralon'), serper: configured('serper'), video: true }, capabilities: Object.keys({ chat: getCapability('chat'), vision: getCapability('vision'), image_generation: getCapability('image_generation'), video: getCapability('video'), web_search: getCapability('web_search'), documents: getCapability('documents'), tables: getCapability('tables'), shopping: getCapability('shopping'), voice: getCapability('voice'), code: getCapability('code'), verification: getCapability('verification') }) });
});

app.post('/chat', async (req, res) => {
  try {
    const { prompt = '', messages, hasImage = false, hasFile = false, hasVideo = false, location = 'Россия' } = req.body || {};
    if (!prompt && !Array.isArray(messages)) return res.status(400).json({ ok: false, error: 'prompt or messages is required' });
    const route = dispatch({ prompt, hasImage, hasFile, hasVideo });
    const chatMessages = Array.isArray(messages) && messages.length ? messages : [{ role: 'user', content: prompt }];
    if (route === 'shopping') return res.json({ ok: true, route, results: await searchShopping(prompt, location, 'find') });
    if (route === 'web_search') return res.json({ ok: true, route, results: await searchWeb(prompt, location) });
    if (route === 'code') return res.json({ ok: true, route, result: await callParalon(chatMessages), model: PARALON_MODEL });
    if (route === 'video') return res.json({ ok: true, route, status: 'routed', message: 'Задача передана модулю видео.' });
    if (route === 'documents') return res.json({ ok: true, route, status: 'routed', message: 'Задача передана модулю документов.' });
    if (route !== 'chat') return res.json({ ok: true, route, status: 'routed', message: `Задача передана модулю: ${route}.` });
    res.json({ ok: true, route, result: await callParalon(chatMessages), model: PARALON_MODEL });
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
