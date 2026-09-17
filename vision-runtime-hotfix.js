const fs = require('fs');
const {execFileSync}=require('child_process');
const file = process.argv[2] || 'local-gateway.js';
let s = fs.readFileSync(file, 'utf8');
// DeepSeek Flash is enabled on this VPS and supports real image input; use it before exhausted/unavailable vision providers.
const marker="async function ask(messages,vision=false){const errors=[],";
const prefix="async function ask(messages,vision=false){const errors=[],";
if(s.includes(marker)&&!s.includes('DEEPSEEK_VISION_PRIMARY')){
  const block="/* DEEPSEEK_VISION_PRIMARY */ if(vision){const dk=keyOf('DEEPSEEK_API_KEY');if(dk)try{return{text:await provider('https://api.deepseek.com/chat/completions',dk,'deepseek-flash',messages,60000,true),provider:'deepseek',model:'deepseek-flash'}}catch(e){errors.push('DeepSeek vision: '+e.message);console.error('DEEPSEEK_VISION_ERROR',e.message)}}";
  s=s.replace(prefix,prefix+block);
}
// Restore Groq Qwen 3.8 as a secondary provider after its rolling limit resets; do not pin the unavailable Qwen 3.6 on this account.
s=s.replaceAll('qwen/qwen3.6-27b','qwen/qwen3.8-27b');
s=s.replaceAll('qwen3.6-27b','qwen3.8-27b');
s=s.replace(/GROQ_VISION_MODEL\s*=\s*[^,;]+/,"GROQ_VISION_MODEL='qwen/qwen3.8-27b'");
s=s.replace(/\/\/ MISTRAL_PHOTO_MIDDLEWARE[\s\S]*?\n(?=app\.post\('\/photo')/g,'');
s=s.replace(/\/\/ VISION_IMAGE_NORMALIZE_MIDDLEWARE[\s\S]*?\n(?=app\.post\('\/photo')/g,'');
fs.writeFileSync(file,s);
try{
  const dropin='/etc/systemd/system/my-ai-unified.service.d/vision-model.conf';
  try{fs.unlinkSync(dropin);console.log('VISION_SYSTEMD_DROPIN_REMOVED')}catch(e){}
  execFileSync('systemctl',['daemon-reload']);
}catch(e){console.error('VISION_SYSTEMD_DROPIN_REMOVE_ERROR',e.message);process.exitCode=1;}
console.log('DEEPSEEK_VISION_PRIMARY_OK');