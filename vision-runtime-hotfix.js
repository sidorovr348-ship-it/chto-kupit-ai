const fs = require('fs');
const { execFileSync } = require('child_process');
const file = process.argv[2] || 'local-gateway.js';
const s = fs.readFileSync(file, 'utf8');

// Vision is now handled by the verified direct Mistral middleware installed by
// image-generation-fallback.js. Keep this step as a safe compatibility check so
// older deploy pipelines can continue to call it without rewriting the gateway.
if (!s.includes('MISTRAL_PHOTO_MIDDLEWARE')) throw new Error('Direct Mistral vision middleware is missing');
try { execFileSync('systemctl', ['daemon-reload']); } catch (e) { console.error('VISION_SYSTEMD_DAEMON_RELOAD_ERROR', e.message); }
console.log('VISION_PROVIDER_FALLBACK_V8_OK');
