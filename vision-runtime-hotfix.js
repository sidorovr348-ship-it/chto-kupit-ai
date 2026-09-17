const fs = require('fs');
const {execFileSync}=require('child_process');
const file = process.argv[2] || 'local-gateway.js';
let s = fs.readFileSync(file, 'utf8');
s = s.replaceAll('qwen/qwen3.8-27b','qwen/qwen3.6-27b');
s = s.replaceAll('qwen3.8-27b','qwen3.6-27b');
s = s.replace(/GROQ_VISION_MODEL\s*=\s*[^,;]+/, "GROQ_VISION_MODEL='qwen/qwen3.6-27b'");
s = s.replace(/\/\/ MISTRAL_PHOTO_MIDDLEWARE[\s\S]*?\n(?=app\.post\('\/photo')/g, '');
s = s.replace(/\/\/ VISION_IMAGE_NORMALIZE_MIDDLEWARE[\s\S]*?\n(?=app\.post\('\/photo')/g, '');
fs.writeFileSync(file, s);
try{
  const dropin='/etc/systemd/system/my-ai-unified.service.d/vision-model.conf';
  execFileSync('mkdir',['-p','/etc/systemd/system/my-ai-unified.service.d']);
  fs.writeFileSync(dropin,'[Service]\nEnvironment=GROQ_VISION_MODEL=qwen/qwen3.6-27b\n');
  execFileSync('systemctl',['daemon-reload']);
  const env=execFileSync('systemctl',['show','-p','Environment','--value','my-ai-unified'],{encoding:'utf8'});
  if(!env.includes('GROQ_VISION_MODEL=qwen/qwen3.6-27b')) console.log('VISION_SYSTEMD_DROPIN_WRITTEN');
  else console.log('VISION_SYSTEMD_ENV_OK');
}catch(e){console.error('VISION_SYSTEMD_DROPIN_ERROR',e.message);process.exitCode=1;}
console.log('VISION_PROVIDER_EXACT_FIX_OK');