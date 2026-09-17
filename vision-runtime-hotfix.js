const fs = require('fs');
const {execFileSync}=require('child_process');
const file = process.argv[2] || 'local-gateway.js';
let s = fs.readFileSync(file, 'utf8');
// Force the available vision model even if the VPS environment or another patch pins qwen3.8.
s = s.replaceAll('qwen/qwen3.8-27b','qwen/qwen3.6-27b');
s = s.replaceAll('qwen3.8-27b','qwen3.6-27b');
s = s.replace(/GROQ_VISION_MODEL\s*=\s*[^,;]+/, "GROQ_VISION_MODEL='qwen/qwen3.6-27b'");
// Remove experimental middleware that rewrites image bytes or spends a request on a known rate-limited Mistral key.
s = s.replace(/\/\/ MISTRAL_PHOTO_MIDDLEWARE[\s\S]*?\n(?=app\.post\('\/photo')/g, '');
s = s.replace(/\/\/ VISION_IMAGE_NORMALIZE_MIDDLEWARE[\s\S]*?\n(?=app\.post\('\/photo')/g, '');
fs.writeFileSync(file, s);
try{
  execFileSync('systemctl',['set-environment','GROQ_VISION_MODEL=qwen/qwen3.6-27b'],{stdio:'pipe'});
  const env=execFileSync('systemctl',['show','-p','Environment','--value','my-ai-unified'],{encoding:'utf8'});
  if(!env.includes('GROQ_VISION_MODEL=qwen/qwen3.6-27b')) throw new Error('systemd environment did not accept qwen3.6 pin');
  console.log('VISION_SYSTEMD_ENV_OK');
}catch(e){console.error('VISION_SYSTEMD_ENV_ERROR',e.message);process.exitCode=1;}
console.log('VISION_PROVIDER_EXACT_FIX_OK');