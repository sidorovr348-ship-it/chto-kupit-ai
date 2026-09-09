const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
let source = fs.readFileSync(serverPath, 'utf8');

if (!source.includes("require('./src/hf-free-agent')")) {
  const anchor = "const cloudru = require('./src/cloudru-agent');";
  if (!source.includes(anchor)) throw new Error('HF bootstrap: server.js anchor not found');
  source = source.replace(anchor, `${anchor}\nconst hfFreeAgent = require('./src/hf-free-agent');`);
}

const marker = "// HF_FREE_AGENT_BOOTSTRAP";
if (!source.includes(marker)) {
  const anchor = "async function callParalon(messages) {\n  const safeMessages = withSystemPrompt(messages);";
  if (!source.includes(anchor)) throw new Error('HF bootstrap: callParalon anchor not found');
  const injection = `${anchor}\n  ${marker}\n  // Text-only chat uses the Hugging Face free allowance first.\n  // By default it never falls through to a paid Paralon request.\n  const textOnly = Array.isArray(safeMessages) && safeMessages.every(m => typeof m?.content === 'string');\n  if (textOnly && hfFreeAgent.configured()) {\n    try {\n      return await hfFreeAgent.call(safeMessages);\n    } catch (error) {\n      if (String(process.env.HF_FREE_ONLY || 'true').toLowerCase() !== 'false') throw error;\n      console.warn('HF free agent unavailable; falling back to Paralon:', error.message);\n    }\n  }`;
  source = source.replace(anchor, injection);
}

if (!source.includes("app.get('/hf/health'")) {
  const anchor = "app.get('/health', (req, res) => {";
  if (!source.includes(anchor)) throw new Error('HF bootstrap: health anchor not found');
  const route = `app.get('/hf/health', (req, res) => {\n  res.set('Cache-Control', 'no-store');\n  res.json({ ok: true, configured: hfFreeAgent.configured(), free_only: String(process.env.HF_FREE_ONLY || 'true').toLowerCase() !== 'false', model: hfFreeAgent.model });\n});\n\n${anchor}`;
  source = source.replace(anchor, route);
}

fs.writeFileSync(serverPath, source);
console.log('HF free agent bootstrap: OK');
