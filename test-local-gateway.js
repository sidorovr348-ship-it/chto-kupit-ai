const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('local-gateway.js','utf8');
assert.doesNotMatch(src,/OPENAI_API_KEY\s*[:=]\s*["'][^"']+/i);
for(const route of ['/chat','/photo','/search','/shopping','/document','/generate-image','/tts','/transcribe','/alice'])assert.ok(src.includes("app.post('"+route+"'"),`missing ${route}`);
assert.ok(src.includes("app.get('/health'"));
// Public internet access: direct URLs, public-host validation, redirect revalidation, and broader page extraction.
for(const marker of ['async function publicWebUrl','async function fetchPublicWebUrl','async function readWebPage','route:\'webpage\'','items.slice(0,5)','t.slice(0,10000)','dns.lookup(host,{all:true,verbatim:true})','redirect:\'manual\''])assert.ok(src.includes(marker),`missing public web access guard/capability: ${marker}`);
for(const marker of ['qwen/qwen3.8-27b','/openai/v1/responses','groqVisionResponses','mistralMessages','groqBlockedUntil','reverseGeocode','wantsMoscowTime','Europe/Moscow','paraloncloud.com/v1/chat/completions','whisper-large-v3-turbo','Access-Control-Allow-Origin','wantsShopping','wantsSearch','.zip','initAutonomy','createAutonomyRuntime({tools:','AUTONOMY_TASK_KIND_NOT_ALLOWED'])assert.ok(src.includes(marker),`missing ${marker}`);
for(const route of ['/autonomy/status','/autonomy/self-check','/autonomy/task'])assert.ok(src.includes(route),`missing ${route}`);
// Regression guard: the final local fallback must not turn a spent deadline into Ollama's 60-second default.
assert.ok(src.includes("if(canStart(6500)){try{const local=await callOllama(messages,{numPredict:300,timeoutMs:Math.min(4000,remaining())})"),'final Ollama fallback must be guarded by remaining deadline');
assert.ok(!src.includes("numPredict:300,timeoutMs:Math.min(7000,remaining())"),'unbounded final Ollama fallback must stay removed');
// Regression guard: chat admission must fail fast under load and share one absolute deadline.
assert.ok(src.includes("'qwen/qwen3.8-27b','openai/gpt-oss-120b','openai/gpt-oss-20b'"),'Groq must use current fallback text models when preferred models are quota-limited');
assert.ok(src.includes("const MAX_TEXT_CONCURRENCY=4;"),'chat concurrency must support overlapping verification requests');
assert.ok(src.includes("Math.min(2500,Math.max(0,deadline-Date.now()))"),'chat queue wait must be bounded to 2.5 seconds');
assert.ok(src.includes("const task=askInternalCore(messages,false,hardDeadline);"),'provider chain must use the caller absolute deadline');
// Companion mode is opt-in and must be wired from the mobile UI through the chat request.
assert.ok(src.includes('if(b.companionMode)m.unshift') && src.includes('Не превращай каждый обычный разговор в психологический анализ'),'companion mode must add the behavior instructions only when explicitly enabled');
const ui=fs.readFileSync('smart-index.html','utf8');
for(const marker of ['id="companion"','memoryId:MEMORY_ID,companionMode',"$('#companion').onclick=()=>{companionMode=!companionMode", "localStorage.getItem('ey-companion-mode')", "localStorage.setItem('ey-companion-mode'"])assert.ok(ui.includes(marker),`missing companion UI wiring: ${marker}`);
// Secondary actions should stay out of the reading area until the user opens the tools dialog.
for(const marker of ['id="toolsToggle"','id="toolsModal"','role="dialog" aria-modal="true"','function openTools()','function closeTools()','e.key===\'Escape\'','id="camAnalyze"','id="camShot"','id="camOff"'])assert.ok(ui.includes(marker),`missing on-demand tools popup wiring: ${marker}`);
assert.ok(ui.includes('window.__ttsPromise=Promise.resolve();return window.__ttsPromise;'),'muted/empty speech must clear stale TTS wait so wake listening can resume promptly');
assert.ok(ui.includes('window.__ttsPromise=Promise.resolve()}'),'stopping speech must clear stale TTS wait so wake listening can resume promptly');
assert.ok(ui.includes('Promise.race([task,new Promise(resolve=>{wakeWaitTimer=setTimeout(()=>{interruptSpeech();resolve()},35000)})])'),'wake recovery must not wait forever for a stalled TTS task');
assert.ok(ui.includes('setTimeout(()=>sttController.abort(),25000)'),'manual voice transcription must have a finite timeout');
assert.ok(ui.includes('Сервер распознавания не ответил за 25 секунд.'),'manual voice timeout must show a clear recovery message');
assert.ok(!ui.includes('<div class="actions"><button id="camAnalyze"'),'camera action buttons must live in the popup, not permanently below the preview');
console.log('SOURCE_SMOKE_OK');
