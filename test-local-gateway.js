const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('local-gateway.js','utf8');
assert.doesNotMatch(src,/OPENAI_API_KEY\s*[:=]\s*["'][^"']+/i);
for(const route of ['/chat','/photo','/search','/shopping','/document','/generate-image','/tts','/transcribe','/alice'])assert.ok(src.includes("app.post('"+route+"'"),`missing ${route}`);
assert.ok(src.includes("app.get('/health'"));
for(const marker of ['qwen/qwen3.8-27b','groqBlockedUntil','reverseGeocode','wantsMoscowTime','Europe/Moscow','paraloncloud.com/v1/chat/completions','whisper-large-v3-turbo','Access-Control-Allow-Origin','wantsShopping','wantsSearch','.zip','initAutonomy','createAutonomyRuntime({tools:','AUTONOMY_TASK_KIND_NOT_ALLOWED'])assert.ok(src.includes(marker),`missing ${marker}`);
for(const route of ['/autonomy/status','/autonomy/self-check','/autonomy/task'])assert.ok(src.includes(route),`missing ${route}`);
console.log('SOURCE_SMOKE_OK');
