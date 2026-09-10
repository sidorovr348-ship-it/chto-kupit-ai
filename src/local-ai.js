const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
// VPS currently has qwen3:0.6b installed. Keep this default aligned with the verified model.
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:0.6b';
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 20000);
const SYSTEM_PROMPT = `Ты — My AI Unified, единый универсальный AI-помощник пользователя. Отвечай по-русски, если пользователь пишет по-русски. Не называй себя ChatGPT, OpenAI, Qwen или Ollama: это внутренние технологии. Не выдумывай выполненные действия. Будь естественным, понятным и полезным. Отвечай кратко, если вопрос простой.`;

async function callOllama(messages, options = {}) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), options.timeoutMs || OLLAMA_TIMEOUT_MS);
  try {
    const safeMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...(Array.isArray(messages) ? messages : [])];
    const body = { model: options.model || OLLAMA_MODEL, messages: safeMessages, stream: false, think: false, options: { temperature: 0.4, num_predict: Number(options.numPredict || 180) } };
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    const text = await response.text(); let data = {}; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) throw Object.assign(new Error(`Local AI error (${response.status})`), { status: 502, details: data });
    const result = String(data?.message?.content || data?.response || '').trim(); if (!result) throw Object.assign(new Error('Local AI returned an empty response'), { status: 502, details: data });
    return result;
  } catch (error) { if (error.name === 'AbortError') throw Object.assign(new Error('Локальный AI не успел ответить'), { status: 504 }); throw error; } finally { clearTimeout(timer); }
}

async function callVision(prompt, images, options = {}) {
  const content = String(prompt || 'Проанализируй изображение.').trim();
  const encoded = (Array.isArray(images) ? images : []).map(image => { const value = String(image || ''); return value.includes(',') ? value.slice(value.indexOf(',') + 1) : value; }).filter(Boolean);
  if (!encoded.length) throw Object.assign(new Error('image is required'), { status: 400 });
  throw Object.assign(new Error('На VPS установлен текстовый локальный AI без поддержки изображений'), { status: 501 });
}

async function health() {
  try { const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) }); const data = await response.json(); const models = Array.isArray(data.models) ? data.models.map(x => x.name) : []; return { ok: response.ok, url: OLLAMA_BASE_URL, model: OLLAMA_MODEL, models }; }
  catch (error) { return { ok: false, url: OLLAMA_BASE_URL, model: OLLAMA_MODEL, error: error.message }; }
}
module.exports = { callOllama, callVision, health, OLLAMA_MODEL };
