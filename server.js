require('dotenv').config({ path: process.env.ENV_FILE || '/root/chto-kupit-ai.env' });

const express = require('express');
const cors = require('cors');
const { dispatch, getCapability } = require('./src/dispatcher');

const app = express();
const PORT = Number(process.env.PORT || 3020);
const PARALON_BASE_URL = process.env.PARALON_BASE_URL || 'https://paraloncloud.com/v1';
const PARALON_MODEL = process.env.PARALON_MODEL || 'qwen3.8-27b';

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

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'my-ai-unified', dispatcher: true, adapters: { paralon: configured('paralon'), serper: configured('serper') }, capabilities: Object.keys({ chat: getCapability('chat'), vision: getCapability('vision'), image_generation: getCapability('image_generation'), video: getCapability('video'), web_search: getCapability('web_search'), documents: getCapability('documents'), tables: getCapability('tables'), shopping: getCapability('shopping'), voice: getCapability('voice'), code: getCapability('code'), verification: getCapability('verification') }) });
});

app.post('/chat', async (req, res) => {
  try {
    const { prompt = '', messages, hasImage = false, hasFile = false, hasVideo = false, location = 'Россия' } = req.body || {};
    if (!prompt && !Array.isArray(messages)) return res.status(400).json({ ok: false, error: 'prompt or messages is required' });
    const route = dispatch({ prompt, hasImage, hasFile, hasVideo });
    const chatMessages = Array.isArray(messages) && messages.length ? messages : [{ role: 'user', content: prompt }];

    if (route === 'shopping') {
      const results = await searchShopping(prompt, location, 'find');
      return res.json({ ok: true, route, results });
    }
    if (route === 'web_search') {
      const results = await searchWeb(prompt, location);
      return res.json({ ok: true, route, results });
    }
    if (route === 'code') {
      const result = await callParalon(chatMessages);
      return res.json({ ok: true, route, result, model: PARALON_MODEL });
    }
    if (route !== 'chat') return res.json({ ok: true, route, status: 'routed', message: `Задача передана модулю: ${route}.` });

    const result = await callParalon(chatMessages);
    res.json({ ok: true, route, result, model: PARALON_MODEL });
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
    const result = await callParalon([{ role: 'user', content }]);
    res.json({ ok: true, route: 'vision', result, model: PARALON_MODEL });
  } catch (error) {
    console.error('PHOTO ERROR:', error);
    res.status(error.status || 500).json({ ok: false, error: error.message || 'Vision request failed' });
  }
});

app.post('/video', async (req, res) => res.status(501).json({ ok: false, route: 'video', error: 'Video adapter is not connected yet', next: 'Connect FFmpeg frame extraction and the vision adapter.' }));

app.post('/shopping', async (req, res) => {
  try {
    const { query, location = 'Россия', mode = 'find' } = req.body || {};
    if (!query) return res.status(400).json({ ok: false, error: 'query is required' });
    const results = await searchShopping(query, location, mode);
    res.json({ ok: true, route: 'shopping', mode, location, results });
  } catch (error) {
    console.error('SHOPPING ERROR:', error);
    res.status(error.status || 500).json({ ok: false, error: error.message || 'Shopping request failed', details: error.details || undefined });
  }
});

// SPA fallback without Express 5 wildcard syntax.
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  res.sendFile(require('path').join(__dirname, 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => console.log(`My AI Unified API started on 127.0.0.1:${PORT}`));
