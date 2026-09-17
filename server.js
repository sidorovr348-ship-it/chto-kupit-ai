const app = require('./legacy-server');

const fetchWithTimeout = async (url, options = {}, timeoutMs = 60000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error('Внешний сервис не ответил вовремя'), { status: 504 });
    throw error;
  } finally { clearTimeout(timer); }
};

function configured(name) {
  if (name === 'groq') return Boolean(process.env.GROQ_API_KEY);
  return false;
}

async function callGroqVision(content) {
  const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b', messages: [{ role: 'user', content }], temperature: 0.2, max_completion_tokens: 700 })
  }, 60000);
  const text = await response.text();
  let data = {}; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw Object.assign(new Error(data.error?.message || 'Groq vision request failed'), { status: response.status, details: data });
  const result = data.choices?.[0]?.message?.content;
  if (!result) throw Object.assign(new Error('Groq vision returned an empty result'), { status: 502, details: data });
  return { result: String(result).trim(), model: data.model || process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b' };
}

app.post('/photo', async (req, res) => {
  try {
    const { prompt = 'Опиши изображение подробно.', image, images } = req.body || {};
    const inputImages = Array.isArray(images) ? images : (image ? [image] : []);
    if (!inputImages.length) return res.status(400).json({ ok: false, error: 'image or images is required' });
    const content = [{ type: 'text', text: String(prompt) }];
    for (const item of inputImages.slice(0, 3)) content.push({ type: 'image_url', image_url: { url: String(item).startsWith('data:') ? item : `data:image/jpeg;base64,${item}` } });

    if (configured('groq')) {
      try {
        const vision = await callGroqVision(content);
        return res.json({ ok: true, route: 'vision', provider: 'groq', result: vision.result, model: vision.model });
      } catch (error) {
        console.error('PHOTO GROQ FALLBACK:', error.message);
      }
    }

    return res.status(503).json({ ok: false, error: 'Анализ фото сейчас недоступен: не настроен или временно недоступен резервный vision-провайдер.' });
  } catch (error) {
    console.error('PHOTO WRAPPER ERROR:', error);
    return res.status(error.status || 500).json({ ok: false, error: error.message || 'Vision request failed' });
  }
});

module.exports = app;
