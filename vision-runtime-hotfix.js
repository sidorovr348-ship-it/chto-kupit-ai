const fs = require('fs');
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
console.log('VISION_PROVIDER_EXACT_FIX_OK');