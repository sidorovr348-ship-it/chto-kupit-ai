const fs = require('fs');
const { execFileSync } = require('child_process');
const file = process.argv[2] || 'local-gateway.js';
let s = fs.readFileSync(file, 'utf8');

// Vision provider order: Mistral (if available), Groq Qwen 3.6, Groq Qwen 3.8, then DeepSeek Flash.
// DeepSeek Flash is natively multimodal and is already configured in this production environment.
if (!s.includes('VISION_PROVIDER_FALLBACK_V4')) {
  const modelsRx = /const models=vision\?\[[^\]]+\]:\[[^\]]+\];/;
  const modelsReplacement = "const models=vision?['qwen/qwen3.6-27b','qwen/qwen3.8-27b']:[GROQ_TEXT_MODEL,'openai/gpt-oss-20b','llama-3.1-8b-instant','llama-3.3-70b-versatile']; /* VISION_PROVIDER_FALLBACK_V4 */";
  if (modelsRx.test(s)) s = s.replace(modelsRx, modelsReplacement);
  else throw new Error('Groq vision model list not found after runtime patches');
}

s = s.replace(/GROQ_VISION_MODEL\s*=\s*process\.env\.GROQ_VISION_MODEL\|\|'[^']+'/g, "GROQ_VISION_MODEL=process.env.GROQ_VISION_MODEL||'qwen/qwen3.6-27b'");
s = s.replace(/GROQ_VISION_MODEL\s*=\s*'qwen\/qwen3\.8-27b'/g, "GROQ_VISION_MODEL=process.env.GROQ_VISION_MODEL||'qwen/qwen3.6-27b'");

if (!s.includes('MISTRAL_VISION_PRIMARY')) {
  const rx = /async function ask\(messages,vision=false\)\{const errors=\[\](?:,|;)/;
  const m = s.match(rx);
  if (m) {
    const block = "async function ask(messages,vision=false){const errors=[];/* MISTRAL_VISION_PRIMARY */ if(vision){const mk=keyOf('MISTRAL_API_KEY','MISTRAL_KEY');if(mk)try{return{text:await provider('https://api.mistral.ai/v1/chat/completions',mk,'mistral-small-latest',messages,60000,true),provider:'mistral',model:'mistral-small-latest'}}catch(e){errors.push('Mistral vision: '+e.message);console.error('MISTRAL_VISION_ERROR',e.message)}}";
    s = s.replace(rx, block);
  } else throw new Error('ask() marker not found');
}

// Add DeepSeek multimodal fallback after Groq vision attempts and before Paralon/Hugging Face.
if (!s.includes('DEEPSEEK_VISION_FALLBACK_V4')) {
  const marker = "const pk=keyOf('PARALON_API_KEY','PARALON_KEY','PARALON_TOKEN');";
  const injection = "if(vision){const dk=keyOf('DEEPSEEK_API_KEY');if(dk)try{return{text:await provider('https://api.deepseek.com/chat/completions',dk,'deepseek-flash',messages,60000,true),provider:'deepseek',model:'deepseek-flash'}}catch(e){errors.push('DeepSeek vision: '+e.message);console.error('DEEPSEEK_VISION_ERROR',e.message)}} /* DEEPSEEK_VISION_FALLBACK_V4 */\nconst pk=keyOf('PARALON_API_KEY','PARALON_KEY','PARALON_TOKEN');";
  if (s.includes(marker)) s = s.replace(marker, injection);
  else throw new Error('Paralon fallback marker not found');
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
console.log('VISION_PROVIDER_FALLBACK_V4_OK');
