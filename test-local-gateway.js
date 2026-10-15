const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('local-gateway.js','utf8');
assert.doesNotMatch(src,/OPENAI_API_KEY\s*[:=]\s*["'][^"']+/i);
for(const route of ['/chat','/photo','/search','/shopping','/document','/generate-image','/tts','/transcribe','/alice'])assert.ok(src.includes("app.post('"+route+"'"),`missing ${route}`);
assert.ok(src.includes("app.get('/health'"));
for(const marker of ['qwen/qwen3.8-27b','/openai/v1/responses','groqVisionResponses','mistralMessages','groqBlockedUntil','reverseGeocode','wantsMoscowTime','Europe/Moscow','paraloncloud.com/v1/chat/completions','whisper-large-v3-turbo','Access-Control-Allow-Origin','wantsShopping','wantsSearch','.zip','initAutonomy','createAutonomyRuntime({tools:','AUTONOMY_TASK_KIND_NOT_ALLOWED'])assert.ok(src.includes(marker),`missing ${marker}`);
for(const route of ['/autonomy/status','/autonomy/self-check','/autonomy/task'])assert.ok(src.includes(route),`missing ${route}`);
// Regression guard: the final local fallback must not turn a spent deadline into Ollama's 60-second default.
assert.ok(src.includes("if(canStart(5000)){try{const local=await callOllama(messages,{numPredict:300,timeoutMs:Math.min(4000,remaining())})"),'final Ollama fallback must be guarded by remaining deadline');
assert.ok(!src.includes("numPredict:300,timeoutMs:Math.min(7000,remaining())"),'unbounded final Ollama fallback must stay removed');
// Regression guard: chat admission must fail fast under load and share one absolute deadline.
assert.ok(src.includes("'qwen/qwen3.8-27b','openai/gpt-oss-120b','openai/gpt-oss-20b'"),'Groq must use current fallback text models when preferred models are quota-limited');
assert.ok(src.includes("const MAX_TEXT_CONCURRENCY=4;"),'chat concurrency must support overlapping verification requests');
assert.ok(src.includes("Math.min(2500,Math.max(0,deadline-Date.now()))"),'chat queue wait must be bounded to 2.5 seconds');
assert.ok(src.includes("const task=askInternalCore(messages,false,hardDeadline);"),'provider chain must use the caller absolute deadline');
console.log('SOURCE_SMOKE_OK');
