const fs = require('fs');
const { execFileSync } = require('child_process');
const file = process.argv[2] || 'local-gateway.js';
let s = fs.readFileSync(file, 'utf8');

// Vision order: DeepSeek Flash first, then multiple Mistral vision models, then Groq.
if (!s.includes('VISION_PROVIDER_FALLBACK_V6')) {
  const modelsRx = /const models=vision\?\[[^\]]+\]:\[[^\]]+\];/;
  const modelsReplacement = "const models=vision?['qwen/qwen3.8-27b']:[GROQ_TEXT_MODEL,'openai/gpt-oss-20b','llama-3.1-8b-instant','llama-3.3-70b-versatile']; /* VISION_PROVIDER_FALLBACK_V6 */";
  if (modelsRx.test(s)) s = s.replace(modelsRx, modelsReplacement);
  else throw new Error('Groq vision model list not found after runtime patches');
}

s = s.replace(/GROQ_VISION_MODEL\s*=\s*process\.env\.GROQ_VISION_MODEL\|\|'[^']+'/g, "GROQ_VISION_MODEL=process.env.GROQ_VISION_MODEL||'qwen/qwen3.8-27b'");

if (!s.includes('DEEPSEEK_VISION_PRIMARY_V6')) {
  const rx = /async function ask\(messages,vision=false\)\{const errors=\[\](?:,|;)/;
  const m = s.match(rx);
  if (m) {
    const block = "async function ask(messages,vision=false){const errors=[];/* DEEPSEEK_VISION_PRIMARY_V6 */ if(vision){const dk=keyOf('DEEPSEEK_API_KEY');if(dk)try{return{text:await provider('https://api.deepseek.com/chat/completions',dk,'deepseek-flash',messages,60000,true),provider:'deepseek',model:'deepseek-flash'}}catch(e){errors.push('DeepSeek vision: '+e.message);console.error('DEEPSEEK_VISION_ERROR',e.message)}} /* MISTRAL_VISION_FALLBACK_V6 */ if(vision){const mk=keyOf('MISTRAL_API_KEY','MISTRAL_KEY');if(mk)for(const mm of ['mistral-small-latest','ministral-14b-latest','mistral-large-2512'])try{return{text:await provider('https://api.mistral.ai/v1/chat/completions',mk,mm,messages,60000,true),provider:'mistral',model:mm}}catch(e){errors.push('Mistral '+mm+': '+e.message);console.error('MISTRAL_VISION_ERROR',mm,e.message)}}";
    s = s.replace(rx, block);
  } else throw new Error('ask() marker not found');
}

s = s.replace(/\/\/ MISTRAL_PHOTO_MIDDLEWARE[\s\S]*?\n(?=app\.post\('\/photo')/g, '');
s = s.replace(/\/\/ VISION_IMAGE_NORMALIZE_MIDDLEWARE[\s\S]*?\n(?=app\.post\('\/photo')/g, '');
fs.writeFileSync(file, s);
try {
  const dropin = '/etc/systemd/system/my-ai-unified.service.d/vision-model.conf';
  try { fs.unlinkSync(dropin); } catch (e) {}
  execFileSync('systemctl', ['daemon-reload']);
} catch (e) {
  console.error('VISION_SYSTEMD_DROPIN_REMOVE_ERROR', e.message);
  process.exitCode = 1;
}
console.log('VISION_PROVIDER_FALLBACK_V6_OK');
