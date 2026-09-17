const fs = require('fs');
const {execFileSync}=require('child_process');
const file = process.argv[2] || 'local-gateway.js';
let s = fs.readFileSync(file, 'utf8');
const askPrefix="async function ask(messages,vision=false){const errors=[];";
if(s.includes(askPrefix)&&!s.includes('MISTRAL_VISION_PRIMARY')){
  const block="async function ask(messages,vision=false){const errors=[];/* MISTRAL_VISION_PRIMARY */ if(vision){const mk=keyOf('MISTRAL_API_KEY','MISTRAL_KEY');if(mk)try{return{text:await provider('https://api.mistral.ai/v1/chat/completions',mk,'mistral-small-latest',messages,60000,true),provider:'mistral',model:'mistral-small-latest'}}catch(e){errors.push('Mistral vision: '+e.message);console.error('MISTRAL_VISION_ERROR',e.message)}}";
  s=s.replace(askPrefix,block);
}
s=s.replaceAll('qwen/qwen3.6-27b','qwen/qwen3.8-27b');
s=s.replaceAll('qwen3.6-27b','qwen3.8-27b');
s=s.replace(/GROQ_VISION_MODEL\s*=\s*[^,;]+/,"GROQ_VISION_MODEL='qwen/qwen3.8-27b'");
s=s.replace(/\/\/ MISTRAL_PHOTO_MIDDLEWARE[\s\S]*?\n(?=app\.post\('\/photo')/g,'');
s=s.replace(/\/\/ VISION_IMAGE_NORMALIZE_MIDDLEWARE[\s\S]*?\n(?=app\.post\('\/photo')/g,'');
fs.writeFileSync(file,s);
try{
  const dropin='/etc/systemd/system/my-ai-unified.service.d/vision-model.conf';
  try{fs.unlinkSync(dropin)}catch(e){}
  execFileSync('systemctl',['daemon-reload']);
}catch(e){console.error('VISION_SYSTEMD_DROPIN_REMOVE_ERROR',e.message);process.exitCode=1;}
console.log('MISTRAL_VISION_PRIMARY_OK');