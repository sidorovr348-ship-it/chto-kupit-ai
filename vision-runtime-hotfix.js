const fs = require('fs');
const { execFileSync } = require('child_process');
const file = process.argv[2] || 'local-gateway.js';
let s = fs.readFileSync(file, 'utf8');

// Vision reliability hardening: use the verified Mistral vision path first.
// This avoids spending the full fallback timeout on a slower/unavailable provider
// before reaching the provider that is currently confirmed in production.
if (!s.includes('VISION_PROVIDER_FALLBACK_V7')) {
  const old = "/* DEEPSEEK_VISION_PRIMARY_V6 */ if(vision){const dk=keyOf('DEEPSEEK_API_KEY');if(dk)try{return{text:await provider('https://api.deepseek.com/chat/completions',dk,'deepseek-flash',messages,60000,true),provider:'deepseek',model:'deepseek-flash'}}catch(e){errors.push('DeepSeek vision: '+e.message);console.error('DEEPSEEK_VISION_ERROR',e.message)}} /* MISTRAL_VISION_FALLBACK_V6 */ if(vision){const mk=keyOf('MISTRAL_API_KEY','MISTRAL_KEY');if(mk)for(const mm of ['mistral-small-latest','ministral-14b-latest','mistral-large-2512'])try{return{text:await provider('https://api.mistral.ai/v1/chat/completions',mk,mm,messages,60000,true),provider:'mistral',model:mm}}catch(e){errors.push('Mistral '+mm+': '+e.message);console.error('MISTRAL_VISION_ERROR',mm,e.message)}}";
  const neu = "/* MISTRAL_VISION_PRIMARY_V7 */ if(vision){const mk=keyOf('MISTRAL_API_KEY','MISTRAL_KEY');if(mk)for(const mm of ['ministral-14b-latest','mistral-small-latest','mistral-large-2512'])try{return{text:await provider('https://api.mistral.ai/v1/chat/completions',mk,mm,messages,45000,true),provider:'mistral',model:mm}}catch(e){errors.push('Mistral '+mm+': '+e.message);console.error('MISTRAL_VISION_ERROR',mm,e.message)}} /* DEEPSEEK_VISION_FALLBACK_V7 */ if(vision){const dk=keyOf('DEEPSEEK_API_KEY');if(dk)try{return{text:await provider('https://api.deepseek.com/chat/completions',dk,'deepseek-flash',messages,45000,true),provider:'deepseek',model:'deepseek-flash'}}catch(e){errors.push('DeepSeek vision: '+e.message);console.error('DEEPSEEK_VISION_ERROR',e.message)}}";
  if (!s.includes(old)) throw new Error('Existing V6 vision block not found');
  s = s.replace(old, neu);
  s += '\n// VISION_PROVIDER_FALLBACK_V7\n';
}
fs.writeFileSync(file, s);
try {
  execFileSync('systemctl', ['daemon-reload']);
} catch (e) {
  console.error('VISION_SYSTEMD_DAEMON_RELOAD_ERROR', e.message);
  process.exitCode = 1;
}
console.log('VISION_PROVIDER_FALLBACK_V7_OK');
