const fs = require('fs');
const file = process.argv[2] || 'local-gateway.js';
let s = fs.readFileSync(file, 'utf8');
// Force the vision model regardless of a stale VPS environment override.
s = s.replace(/GROQ_VISION_MODEL\s*=\s*[^,;]+/, "GROQ_VISION_MODEL='qwen/qwen3.6-27b'");
// Remove experimental middleware that rewrites image bytes or spends a request on a known rate-limited Mistral key.
s = s.replace(/\/\/ MISTRAL_PHOTO_MIDDLEWARE[\s\S]*?\n(?=app\.post\('\/photo')/g, '');
s = s.replace(/\/\/ VISION_IMAGE_NORMALIZE_MIDDLEWARE[\s\S]*?\n(?=app\.post\('\/photo')/g, '');
fs.writeFileSync(file, s);
console.log('VISION_PROVIDER_ROBUST_FIX_OK');