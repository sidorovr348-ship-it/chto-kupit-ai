require('dotenv').config({ path: process.env.ENV_FILE || '/root/chto-kupit-ai.env' });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { dispatch, getCapability } = require('./src/dispatcher');
const { diagnostics } = require('./supervisor');
const { extractDocumentText } = require('./src/document-tools');
const cloudru = require('./src/cloudru-agent');

const app = express();
const PORT = Number(process.env.PORT || 3020);
const PARALON_BASE_URL = process.env.PARALON_BASE_URL || 'https://paraloncloud.com/v1';
const PARALON_MODEL = process.env.PARALON_MODEL || 'qwen3.8-27b';
const MEDIA_ROOT = process.env.VERCEL ? '/tmp/my-ai-unified-media' : path.join(__dirname, 'media');
const INPUT_DIR = path.join(MEDIA_ROOT, 'input');
const TEMP_DIR = path.join(MEDIA_ROOT, 'temp');
for (const dir of [INPUT_DIR, TEMP_DIR]) fs.mkdirSync(dir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '35mb' }));
app.use(express.static(__dirname));

const SYSTEM_PROMPT = `Ты — My AI Unified, единый универсальный AI-помощник пользователя. Отвечай на русском, если пользователь пишет по-русски. Не называй себя ChatGPT и не утверждай, что ты создан OpenAI. Не называй себя Qwen или Paralon: это внутренние технологии. Будь полезным, точным и честным; не выдумывай выполненные действия. Если данных недостаточно — прямо скажи об этом.`;

function configured(name) {
  if (name === 'paralon') return Boolean(process.env.PARALON_API_KEY);
  if (name === 'serper') return Boolean(process.env.SERPER_API_KEY);
  if (name === 'cloudru') return cloudru.configured();
  return false;
}

function textFromMessages(messages) {
  const last = [...(Array.isArray(messages) ? messages : [])].reverse().find(m => m && m.role === 'user');
  if (!last) return '';
  if (typeof last.content === 'string') return last.content;
  if (Array.isArray(last.content)) return last.content.filter(x => x?.type === 'text').map(x => x.text || '').join('\n');
  return String(last.content || '');
}

function withSystemPrompt(messages) {
  const clean = Array.isArray(messages) ? messages.filter(m => m?.role !== 'system') : [];
  return [{ role: 'system', content: SYSTEM_PROMPT }, ...clean];
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error('Внешний сервис не ответил вовремя'), { status: 504 });
    throw error;
  } finally { clearTimeout(timer); }
}

async function callEmergencyTextFallback(messages) {
  const userText = textFromMessages(messages);
  if (!userText) throw Object.assign(new Error('Пустой запрос'), { status: 400 });
  const prompt = `${SYSTEM_PROMPT}\n\nПользователь:\n${userText}`;
  const response = await fetchWithTimeout(`https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`, { headers: { Accept: 'text/plain' } }, 30000);
  const text = await response.text();
  if (!response.ok || !text.trim()) throw Object.assign(new Error('Аварийный AI-режим не ответил'), { status: response.status || 502, details: text.slice(0, 500) });
  return text.trim();
}

async function callParalon(messages) {
  const safeMessages = withSystemPrompt(messages);
  if (!configured('paralon')) {
    console.warn('PARALON_API_KEY missing; using emergency text AI fallback');
    return callEmergencyTextFallback(safeMessages);
  }
  const response = await fetchWithTimeout(`${PARALON_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.PARALON_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: PARALON_MODEL, messages: safeMessages })
  }, 60000);
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw Object.assign(new Error('Paralon request failed'), { status: response.status, details: data });
  return data.choices?.[0]?.message?.content || '';
}

async function searchWeb(query, location = 'Россия') {
  if (!configured('serper')) throw Object.assign(new Error('SERPER_API_KEY is not configured'), { status: 503 });
  const response = await fetchWithTimeout('https://google.serper.dev/search', {
    method: 'POST', headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: `${query} ${location}`, gl: 'ru', hl: 'ru', num: 6 })
  }, 15000);
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw Object.assign(new Error('Web search failed'), { status: response.status, details: data });
  return Array.isArray(data.organic) ? data.organic.slice(0, 6).map(item => ({ title: item.title || '', url: item.link || '', content: item.snippet || '' })) : [];
}

function fallbackSearchAnswer(results) {
  const items = (Array.isArray(results) ? results : []).filter(x => x?.title || x?.content).slice(0, 5);
  if (!items.length) return 'Поиск не вернул подходящих результатов.';
  return `Вот что нашёл в интернете:\n\n${items.map((x, i) => `${i + 1}. ${x.title || 'Источник'}\n${x.content || 'Без описания.'}${x.url ? `\nИсточник: ${x.url}` : ''}`).join('\n\n')}`;
}

async function answerFromSearch(query, results, location = 'Россия') {
  const items = (Array.isArray(results) ? results : []).slice(0, 5);
  const compact = items.map((x, i) => `[${i + 1}] ${x.title}\nURL: ${x.url}\nФрагмент: ${x.content}`).join('\n\n');
  if (!compact) return 'Поиск не вернул подходящих результатов.';
  const prompt = `Ответь пользователю по-русски только на основании результатов поиска. Не выдумывай. Для важных утверждений указывай [номер источника]. В конце дай раздел «Источники». Запрос: ${query}. Регион: ${location}.\n\n${compact}`;
  try {
    const synthesized = await Promise.race([callParalon([{ role: 'user', content: prompt }]), new Promise(resolve => setTimeout(() => resolve(null), 12000))]);
    return synthesized && String(synthesized).trim() ? String(synthesized).trim() : fallbackSearchAnswer(results);
  } catch { return fallbackSearchAnswer(results); }
}

async function serperRequest(endpoint, body, timeoutMs = 15000) {
  if (!configured('serper')) throw Object.assign(new Error('SERPER_API_KEY is not configured'), { status: 503 });
  const response = await fetchWithTimeout(`https://google.serper.dev/${endpoint}`, {
    method: 'POST', headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }, timeoutMs);
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw Object.assign(new Error(`Serper ${endpoint} failed (${response.status})`), { status: response.status, details: data });
  return data;
}

function parsePrice(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value || '').replace(/\u00a0/g, ' ').trim();
  const match = raw.match(/\d[\d\s.,]*/);
  if (!match) return null;
  const normalized = match[0].replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(/,(?=\d{2}(?:\D|$))/, '.');
  const number = Number(normalized.replace(/[^0-9.]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function normalizeShoppingItem(item, index) {
  const priceText = item.price || item.priceText || '';
  const priceValue = parsePrice(item.priceValue ?? item.extractedPrice ?? priceText);
  const source = item.source || item.merchant || '';
  const link = item.link || item.url || '';
  return { title: item.title || '', url: link, content: item.snippet || item.content || '', merchant: source, price: priceText, priceValue, currency: item.currency || 'RUB', availability: item.availability || '', rating: item.rating ?? null, ratingCount: item.ratingCount ?? null, imageUrl: item.imageUrl || item.image || '', position: index + 1 };
}

async function searchShopping(query, location = 'Россия', mode = 'find') {
  const cleanQuery = String(query).trim();
  if (!cleanQuery) throw Object.assign(new Error('query is required'), { status: 400 });
  const q = mode === 'cheaper' ? `${cleanQuery} купить дешевле ${location}` : `${cleanQuery} купить ${location}`;
  const data = await serperRequest('shopping', { q, gl: 'ru', hl: 'ru', num: 20 });
  const items = Array.isArray(data.shopping) ? data.shopping : [];
  const allowed = ['ozon.ru', 'wildberries.ru', 'market.yandex.ru', 'dns-shop.ru', 'mvideo.ru', 'citilink.ru', 'aliexpress.ru', 'detmir.ru', 'eldorado.ru', 'holodilnik.ru', 'sbermegamarket.ru'];
  const normalized = items.map(normalizeShoppingItem).filter(x => x.title || x.price || x.merchant);
  const preferred = normalized.filter(x => allowed.some(domain => String(x.url || '').toLowerCase().includes(domain) || String(x.merchant || '').toLowerCase().includes(domain.replace('.ru', ''))));
  const result = preferred.length ? preferred : normalized;
  return (mode === 'cheaper' ? result.filter(x => x.priceValue != null).sort((a, b) => a.priceValue - b.priceValue) : result).slice(0, 10);
}

function runCommand(command, args, timeout = 30000) {
  return new Promise((resolve, reject) => execFile(command, args, { timeout, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => error ? reject(Object.assign(error, { stderr })) : resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') })));
}

async function extractVideoFrames(inputFile) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const durationResult = await runCommand('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', inputFile]).catch(() => ({ stdout: '6' }));
  const duration = Math.max(0.1, Number.parseFloat(durationResult.stdout) || 6);
  const points = [...new Set([Math.max(0, duration * 0.15), Math.max(0, duration * 0.5), Math.max(0, duration * 0.85)].map(x => Math.min(Math.max(0, x), Math.max(0, duration - 0.05))))];
  const files = [];
  for (let i = 0; i < points.length; i++) {
    const file = path.join(TEMP_DIR, `frame-${stamp}-${i + 1}.jpg`);
    await runCommand('ffmpeg', ['-y', '-ss', String(points[i]), '-i', inputFile, '-frames:v', '1', '-vf', 'scale=512:-2', '-q:v', '5', file]);
    if (fs.existsSync(file)) files.push(file);
  }
  return files;
}

async function analyzeVideo(images) {
  const content = [{ type: 'text', text: 'Проанализируй выбранные кадры видео. Опиши происходящее, объекты, действия и важные детали. Если по кадрам нельзя уверенно сделать вывод — так и скажи.' }];
  for (const image of images) content.push({ type: 'image_url', image_url: { url: image } });
  return callParalon([{ role: 'user', content }]);
}

function makeImageUrl(prompt) {
  const clean = String(prompt || '').trim();
  if (!clean) throw Object.assign(new Error('prompt is required'), { status: 400 });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(clean)}?width=1024&height=1024&nologo=true`;
}

function clampText(text, max = 120000) { return String(text || '').slice(0, max); }

async function analyzeExtractedFile(buffer, filename, prompt, kindHint) {
  const extracted = await extractDocumentText(buffer, filename);
  const kind = kindHint || extracted.kind;
  const instruction = prompt || (kind === 'table' ? 'Проанализируй таблицу: дай краткое резюме, ключевые показатели, аномалии и полезные выводы.' : 'Проанализируй документ: дай краткое резюме, ключевые факты и важные выводы.');
  const content = `${instruction}\n\nФайл: ${filename}\nТип: ${kind}\n\nСодержимое:\n${clampText(extracted.text)}`;
  return { ...extracted, result: await callParalon([{ role: 'user', content }]) };
}

app.get('/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, service: 'my-ai-unified', dispatcher: true, adapters: { paralon: configured('paralon'), paralon_fallback: true, serper: configured('serper'), video: true, cloudru: configured('cloudru') }, capabilities: Object.keys({ chat: getCapability('chat'), vision: getCapability('vision'), image_generation: getCapability('image_generation'), video: getCapability('video'), web_search: getCapability('web_search'), documents: getCapability('documents'), tables: getCapability('tables'), shopping: getCapability('shopping'), voice: getCapability('voice'), code: getCapability('code'), verification: getCapability('verification'), cloud_agent: true }) });
});

app.get('/cloudru/health', async (req, res) => {
  try {
    if (!configured('cloudru')) return res.status(503).json({ ok: false, configured: false, error: 'CLOUDRU_AGENT_URL is not configured' });
    const card = await cloudru.getAgentCard();
    res.json({ ok: true, configured: true, agent: { name: card.name || card.title || null, description: card.description || null, url: card.url || null, protocol: 'A2A' } });
  } catch (error) { res.status(error.status || 502).json({ ok: false, configured: true, error: error.message }); }
});

app.post('/cloudru', async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({ ok: false, error: 'prompt is required' });
    const answer = await cloudru.ask(prompt, { contextId: req.body?.contextId });
    res.json({ ok: true, route: 'cloud_agent', result: answer.result, raw: answer.raw });
  } catch (error) { console.error('CLOUDRU ERROR:', error); res.status(error.status || 502).json({ ok: false, route: 'cloud_agent', error: error.message, details: error.details || undefined }); }
});

app.get('/diagnostics', async (req, res) => {
  try { const result = await diagnostics(); res.set('Cache-Control', 'no-store'); res.json({ ok: result.ok, route: 'verification', result: result.ok ? 'Проверка завершена: сервер, интернет и тесты работают.' : 'Проверка завершена: обнаружена проблема.', diagnostics: result }); }
  catch (error) { res.status(500).json({ ok: false, route: 'verification', result: 'Диагностика завершилась ошибкой.', error: error.message }); }
});

app.post('/chat', async (req, res) => {
  try {
    const { prompt = '', messages, hasImage = false, hasFile = false, hasVideo = false, location = 'Россия' } = req.body || {};
    const chatMessages = Array.isArray(messages) && messages.length ? messages : (prompt ? [{ role: 'user', content: prompt }] : []);
    const userPrompt = String(prompt || textFromMessages(chatMessages)).trim();
    if (!userPrompt && !chatMessages.length) return res.status(400).json({ ok: false, error: 'prompt or messages is required' });
    if (configured('cloudru') && process.env.CLOUDRU_AGENT_AUTO === 'true' && /\bcloud\.ru\b|облачн.*агент|через cloudru|через cloud\.ru/iu.test(userPrompt)) {
      const answer = await cloudru.ask(userPrompt);
      return res.json({ ok: true, route: 'cloud_agent', result: answer.result, raw: answer.raw });
    }
    const route = dispatch({ prompt: userPrompt, hasImage, hasFile, hasVideo });
    if (route === 'verification') { const result = await diagnostics(); return res.json({ ok: result.ok, route, result: result.ok ? 'Проверка завершена: критических проблем не обнаружено.' : 'Проверка завершена: обнаружена проблема.', diagnostics: result }); }
    if (route === 'shopping') return res.json({ ok: true, route, results: await searchShopping(userPrompt, location, /дешевле|самый дешёвый|где дешевле/iu.test(userPrompt) ? 'cheaper' : 'find') });
    if (route === 'web_search') { const results = await searchWeb(userPrompt, location); return res.json({ ok: true, route, result: await answerFromSearch(userPrompt, results, location), sources: results }); }
    if (route === 'image_generation') return res.json({ ok: true, route, imageUrl: makeImageUrl(userPrompt), result: 'Изображение подготовлено.' });
    if (route === 'code') return res.json({ ok: true, route, result: await callParalon(chatMessages), model: PARALON_MODEL });
    if (route === 'video') return res.json({ ok: true, route, status: 'ready', message: 'Для анализа видео отправь видео через кнопку «Видео».' });
    if (route === 'documents' || route === 'tables') return res.json({ ok: true, route, status: 'ready', message: 'Отправь файл — я извлеку его содержимое и проанализирую.' });
    res.json({ ok: true, route: 'chat', result: await callParalon(chatMessages), model: configured('paralon') ? PARALON_MODEL : 'emergency-text-fallback' });
  } catch (error) { console.error('CHAT ERROR:', error); res.status(error.status || 500).json({ ok: false, error: error.message || 'AI request failed', details: error.details || undefined }); }
});

app.post('/photo', async (req, res) => {
  try {
    const { prompt = 'Опиши изображение подробно.', image, images } = req.body || {};
    const inputImages = Array.isArray(images) ? images : (image ? [image] : []);
    if (!inputImages.length) return res.status(400).json({ ok: false, error: 'image or images is required' });
    if (!configured('paralon')) return res.status(503).json({ ok: false, error: 'Для анализа фото нужен основной AI-ключ Paralon; аварийный режим работает только для обычного текста.' });
    const content = [{ type: 'text', text: prompt }];
    for (const item of inputImages) content.push({ type: 'image_url', image_url: { url: String(item).startsWith('data:') ? item : `data:image/jpeg;base64,${item}` } });
    res.json({ ok: true, route: 'vision', result: await callParalon([{ role: 'user', content }]), model: PARALON_MODEL });
  } catch (error) { console.error('PHOTO ERROR:', error); res.status(error.status || 500).json({ ok: false, error: error.message || 'Vision request failed' }); }
});

app.post('/document', async (req, res) => {
  try {
    const { filename = 'document', data, prompt = '', kind } = req.body || {};
    if (!data) return res.status(400).json({ ok: false, error: 'data is required' });
    const base64 = String(data).includes(',') ? String(data).slice(String(data).indexOf(',') + 1) : String(data);
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) return res.status(400).json({ ok: false, error: 'empty file' });
    const result = await analyzeExtractedFile(buffer, filename, prompt, kind);
    res.json({ ok: true, route: result.kind === 'table' ? 'tables' : 'documents', filename, result: result.result, extractedCharacters: result.text.length, model: PARALON_MODEL });
  } catch (error) { console.error('DOCUMENT ERROR:', error); res.status(error.status || 500).json({ ok: false, error: error.message || 'Document processing failed' }); }
});

app.post('/table', async (req, res) => {
  try {
    const { filename = 'table.csv', data, prompt = '' } = req.body || {};
    if (!data) return res.status(400).json({ ok: false, error: 'data is required' });
    const base64 = String(data).includes(',') ? String(data).slice(String(data).indexOf(',') + 1) : String(data);
    const result = await analyzeExtractedFile(Buffer.from(base64, 'base64'), filename, prompt, 'table');
    res.json({ ok: true, route: 'tables', filename, result: result.result, extractedCharacters: result.text.length, model: PARALON_MODEL });
  } catch (error) { console.error('TABLE ERROR:', error); res.status(error.status || 500).json({ ok: false, error: error.message || 'Table processing failed' }); }
});

app.post('/image', async (req, res) => {
  try { res.json({ ok: true, route: 'image_generation', imageUrl: makeImageUrl(req.body?.prompt) }); }
  catch (error) { res.status(error.status || 400).json({ ok: false, error: error.message }); }
});

app.post('/video', async (req, res) => {
  let inputFile = null; const frameFiles = [];
  try {
    const raw = String(req.body?.video || req.body?.data || '');
    if (!raw) return res.status(400).json({ ok: false, error: 'video or data is required' });
    const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
    inputFile = path.join(TEMP_DIR, `video-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
    fs.writeFileSync(inputFile, Buffer.from(base64, 'base64'));
    frameFiles.push(...await extractVideoFrames(inputFile));
    if (!frameFiles.length) return res.status(502).json({ ok: false, error: 'Не удалось извлечь кадры видео' });
    const images = frameFiles.map(file => `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`);
    res.json({ ok: true, route: 'video', result: await analyzeVideo(images), frames: images.length, model: PARALON_MODEL });
  } catch (error) { console.error('VIDEO ERROR:', error); res.status(error.status || 502).json({ ok: false, error: error.message || 'Ошибка обработки видео' }); }
  finally { if (inputFile) { try { fs.unlinkSync(inputFile); } catch {} } for (const file of frameFiles) { try { fs.unlinkSync(file); } catch {} } }
});

app.post('/shopping', async (req, res) => {
  try { const { query, location = 'Россия', mode = 'find' } = req.body || {}; if (!query) return res.status(400).json({ ok: false, error: 'query is required' }); res.json({ ok: true, route: 'shopping', mode, location, results: await searchShopping(query, location, mode) }); }
  catch (error) { console.error('SHOPPING ERROR:', error); res.status(error.status || 500).json({ ok: false, error: error.message || 'Shopping request failed', details: error.details || undefined }); }
});

app.use((req, res, next) => { if (req.method !== 'GET' || req.path.startsWith('/api/')) return next(); res.sendFile(path.join(__dirname, 'index.html')); });
if (!process.env.VERCEL) app.listen(PORT, '127.0.0.1', () => console.log(`My AI Unified API started on 127.0.0.1:${PORT}`));
module.exports = app;
