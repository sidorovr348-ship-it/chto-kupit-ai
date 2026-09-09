const express = require('express');
const { execFileSync } = require('child_process');
const { dispatch } = require('./src/dispatcher');
const { callOllama, callVision, health, OLLAMA_MODEL } = require('./src/local-ai');

const app = express();
const PORT = Number(process.env.PORT || 3020);
const LEGACY_URL = process.env.LEGACY_URL || 'http://127.0.0.1:3021';
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

async function proxy(req, res) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    const response = await fetch(`${LEGACY_URL}${req.originalUrl}`, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body || {}),
      signal: controller.signal
    });
    clearTimeout(timer);
    const text = await response.text();
    res.status(response.status).type(response.headers.get('content-type') || 'application/json').send(text);
  } catch (error) { res.status(502).json({ ok: false, error: 'Legacy module unavailable', details: error.message }); }
}

app.get('/health', async (req, res) => {
  const local = await health();
  res.set('Cache-Control', 'no-store');
  res.status(local.ok ? 200 : 503).json({
    ok: local.ok,
    service: 'my-ai-unified',
    dispatcher: true,
    local_ai: local,
    adapters: { local: local.ok, ollama: local.ok, video: true, shopping: true },
    capabilities: ['chat','vision','image_generation','video','web_search','documents','tables','shopping','voice','code','verification']
  });
});

app.post('/chat', async (req, res) => {
  try {
    const { prompt = '', messages, hasImage = false, hasFile = false, hasVideo = false } = req.body || {};
    const chatMessages = Array.isArray(messages) && messages.length ? messages : (prompt ? [{ role: 'user', content: prompt }] : []);
    const userPrompt = String(prompt || textFromMessages(chatMessages)).trim();
    if (!userPrompt && !chatMessages.length) return res.status(400).json({ ok: false, error: 'prompt or messages is required' });
    const route = dispatch({ prompt: userPrompt, hasImage, hasFile, hasVideo });
    if (route === 'chat' || route === 'code') {
      const answer = await callOllama(chatMessages, { numPredict: route === 'code' ? 900 : 500 });
      return res.json({ ok: true, route, result: answer.result, model: answer.model, local: true });
    }
    if (route === 'vision' && req.body?.image) {
      const answer = await callVision(userPrompt || 'Проанализируй изображение.', [req.body.image]);
      return res.json({ ok: true, route, result: answer.result, model: answer.model, local: true });
    }
    return proxy(req, res);
  } catch (error) { res.status(error.status || 502).json({ ok: false, error: error.message, details: error.details }); }
});

app.post('/photo', async (req, res) => {
  try {
    const images = Array.isArray(req.body?.images) ? req.body.images : (req.body?.image ? [req.body.image] : []);
    const answer = await callVision(req.body?.prompt || 'Опиши изображение подробно.', images);
    res.json({ ok: true, route: 'vision', result: answer.result, model: answer.model, local: true });
  } catch (error) { res.status(error.status || 502).json({ ok: false, error: error.message, details: error.details }); }
});

app.post('/alice', async (req, res) => {
  const command = String(req.body?.request?.command || req.body?.request?.original_utterance || '').trim();
  const sessionId = String(req.body?.session?.session_id || 'default');
  if (!command || /^ping$/iu.test(command)) return res.json({ version: '1.0', response: { text: 'Мой AI на связи.', end_session: false } });
  try {
    const answer = await callOllama([{ role: 'user', content: command }], { timeoutMs: 3900, numPredict: 220 });
    const text = String(answer.result || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim().slice(0, 1024) || 'Я готов продолжать.';
    return res.json({ version: '1.0', response: { text, end_session: false }, session_state: { session_id: sessionId, local: true, model: answer.model } });
  } catch (error) {
    const quick = /кто тебя создал/iu.test(command) ? 'Меня создал Roman.' : /как тебя зовут/iu.test(command) ? 'Мой AI.' : 'Я получил запрос, но локальный AI сейчас занят. Повтори вопрос.';
    return res.json({ version: '1.0', response: { text: quick, end_session: false }, session_state: { session_id: sessionId, local: false, fallback: true } });
  }
});

app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/chat' || req.path === '/photo' || req.path === '/alice') return next();
  proxy(req, res);
});

try {
  execFileSync('/usr/bin/fuser', ['-k', `${PORT}/tcp`], { stdio: 'ignore' });
} catch (_) {}
app.listen(PORT, '127.0.0.1', () => console.log(`My AI Unified local gateway on 127.0.0.1:${PORT}; model=${OLLAMA_MODEL}`));
