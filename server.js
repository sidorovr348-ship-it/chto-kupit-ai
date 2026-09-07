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
    body: JSON.stringify({ q: query, location })
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error('Serper request failed');
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data.organic || [];
}

async function searchShopping(query, location = 'Россия') {
  if (!configured('serper')) {
    const error = new Error('SERPER_API_KEY is not configured');
    error.status = 503;
    throw error;
  }
  const response = await fetch('https://google.serper.dev/shopping', {
    method: 'POST',
    headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, location })
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error('Serper shopping request failed');
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data.shopping || [];
}

function extractFrames(videoPath, outputDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(outputDir, { recursive: true });
    execFile('ffmpeg', ['-y', '-i', videoPath, '-vf', 'fps=1', path.join(outputDir, 'frame-%03d.jpg')], (error) => {
      if (error) return reject(error);
      resolve(fs.readdirSync(outputDir).filter((f) => f.endsWith('.jpg')).map((f) => path.join(outputDir, f)));
    });
  });
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'my-ai-unified',
    dispatcher: true,
    adapters: {
      paralon: configured('paralon'),
      serper: configured('serper'),
      video: true
    },
    capabilities: ['chat', 'vision', 'image_generation', 'video', 'documents', 'shopping', 'web_search', 'voice', 'code']
  });
});

app.post('/chat', async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    const route = dispatch({ prompt, hasImage: false, hasFile: false, hasVideo: false });
    if (route === 'shopping') {
      const items = await searchShopping(prompt);
      return res.json({ ok: true, route, result: items });
    }
    if (route === 'web_search') {
      const results = await searchWeb(prompt);
      return res.json({ ok: true, route, result: results });
    }
    const result = await callParalon([{ role: 'user', content: prompt }]);
    res.json({ ok: true, route, result });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, details: error.details || null });
  }
});

app.post('/photo', async (req, res) => {
  try {
    const dataUrl = String(req.body?.image || '');
    const prompt = String(req.body?.prompt || 'Опиши изображение подробно.').trim();
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ ok: false, error: 'Invalid image data' });
    const result = await callParalon([{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }]);
    res.json({ ok: true, route: 'vision', result });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, details: error.details || null });
  }
});

app.post('/video', async (req, res) => {
  try {
    const dataUrl = String(req.body?.video || '');
    const prompt = String(req.body?.prompt || 'Проанализируй видео.').trim();
    const match = dataUrl.match(/^data:video\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
    if (!match) return res.status(400).json({ ok: false, error: 'Invalid video data' });
    const videoPath = path.join(INPUT_DIR, `video-${Date.now()}.mp4`);
    fs.writeFileSync(videoPath, Buffer.from(match[1], 'base64'));
    const frameDir = path.join(TEMP_DIR, `frames-${Date.now()}`);
    const frames = await extractFrames(videoPath, frameDir);
    const content = [{ type: 'text', text: prompt }, ...frames.slice(0, 12).map((file) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}` } }))];
    const result = await callParalon([{ role: 'user', content }]);
    res.json({ ok: true, route: 'video', frames: frames.length, result });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, details: error.details || null });
  }
});

app.post('/shopping', async (req, res) => {
  try {
    const query = String(req.body?.query || req.body?.prompt || '').trim();
    const result = await searchShopping(query, req.body?.location || 'Россия');
    res.json({ ok: true, route: 'shopping', result });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, details: error.details || null });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Redeploy checkpoint: keep runtime configuration sourced from Vercel environment variables.
if (!process.env.VERCEL) app.listen(PORT, '127.0.0.1', () => console.log(`My AI Unified listening on ${PORT}`));

module.exports = app;
