const HF_URL = process.env.HF_ROUTER_URL || 'https://router.huggingface.co/v1/chat/completions';
const HF_MODEL = process.env.HF_FREE_MODEL || 'google/gemma-2-2b-it:cheapest';
const TIMEOUT_MS = Number(process.env.HF_TIMEOUT_MS || 45000);

function configured() {
  return Boolean(String(process.env.HF_TOKEN || '').trim());
}

async function call(messages) {
  if (!configured()) throw Object.assign(new Error('HF_TOKEN is not configured'), { code: 'HF_NOT_CONFIGURED', status: 503 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${String(process.env.HF_TOKEN).trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages,
        max_tokens: Number(process.env.HF_MAX_TOKENS || 1200),
        temperature: 0.3
      }),
      signal: controller.signal
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) {
      throw Object.assign(new Error(`Hugging Face request failed (${response.status})`), {
        code: 'HF_REQUEST_FAILED', status: response.status, details: data
      });
    }
    const answer = data.choices?.[0]?.message?.content;
    if (!answer || !String(answer).trim()) {
      throw Object.assign(new Error('Hugging Face returned an empty answer'), { code: 'HF_EMPTY', status: 502, details: data });
    }
    return String(answer).trim();
  } catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error('Hugging Face не ответил вовремя'), { code: 'HF_TIMEOUT', status: 504 });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { configured, call, model: HF_MODEL };
