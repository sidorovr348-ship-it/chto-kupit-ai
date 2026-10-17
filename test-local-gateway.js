const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('local-gateway.js','utf8');
assert.doesNotMatch(src,/OPENAI_API_KEY\s*[:=]\s*["'][^"']+/i);
for(const route of ['/chat','/photo','/search','/shopping','/document','/generate-image','/tts','/transcribe','/alice'])assert.ok(src.includes("app.post('"+route+"'"),`missing ${route}`);
assert.ok(src.includes("app.get('/health'"));
// Public internet access: direct URLs, public-host validation, redirect revalidation, and broader page extraction.
for(const marker of ['async function publicWebUrl','async function fetchPublicWebUrl','async function readWebPage','route:\'webpage\'','items.slice(0,5)','t.slice(0,10000)','dns.lookup(host,{all:true,verbatim:true})','redirect:\'manual\''])assert.ok(src.includes(marker),`missing public web access guard/capability: ${marker}`);
for(const marker of ['qwen/qwen3.8-27b','/openai/v1/responses','groqVisionResponses','mistralMessages','groqBlockedUntil','reverseGeocode','wantsMoscowTime','Europe/Moscow','WEATHER_PRIMARY_FAILED','WEATHER_FALLBACK_FAILED','api.met.no/weatherapi/locationforecast/2.0/compact','paraloncloud.com/v1/chat/completions','whisper-large-v3-turbo','Access-Control-Allow-Origin','wantsShopping','wantsSearch','.zip','initAutonomy','createAutonomyRuntime({tools:','AUTONOMY_TASK_KIND_NOT_ALLOWED'])assert.ok(src.includes(marker),`missing ${marker}`);
for(const route of ['/autonomy/status','/autonomy/self-check','/autonomy/task'])assert.ok(src.includes(route),`missing ${route}`);
// Regression guard: the final local fallback must not turn a spent deadline into Ollama's 60-second default.
assert.ok(src.includes("if(canStart(6500)){try{const local=await callOllama(messages,{numPredict:300,timeoutMs:Math.min(4000,remaining())})"),'final Ollama fallback must be guarded by remaining deadline');
assert.ok(!src.includes("numPredict:300,timeoutMs:Math.min(7000,remaining())"),'unbounded final Ollama fallback must stay removed');
// Regression guard: chat admission must fail fast under load and share one absolute deadline.
assert.ok(src.includes("'qwen/qwen3.8-27b','openai/gpt-oss-120b','openai/gpt-oss-20b'"),'Groq must use current fallback text models when preferred models are quota-limited');
assert.ok(src.includes("const MAX_TEXT_CONCURRENCY=4;"),'chat concurrency must support overlapping verification requests');
assert.ok(src.includes("Math.min(2500,Math.max(0,deadline-Date.now()))"),'chat queue wait must be bounded to 2.5 seconds');
assert.ok(src.includes("const task=askInternalCore(messages,false,hardDeadline);"),'provider chain must use the caller absolute deadline');
assert.ok(src.includes("chatDeadlineTimer=setTimeout(()=>{if(!res.headersSent&&!res.writableEnded)"),'whole /chat route must have a deadline, including preprocessing and transcription');
assert.ok(src.includes("if(res.headersSent||res.writableEnded)return res;"),'late async completion must not attempt a second response after the request deadline');
assert.ok(src.includes("'CHAT_REQUEST_DEADLINE'"),'whole-route deadline must be logged for diagnosis');
assert.ok(src.includes("result:fallback.text,provider:fallback.provider,model:fallback.model,warning:fallback.warning"),'whole-route timeout response must use the frontend-compatible result field');
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
assert.ok(ui.includes('followupUntil=Date.now()+12000'),'wake listener must accept a direct follow-up question for 12 seconds after an answer');
assert.ok(ui.includes('Date.now()<armedUntil||Date.now()<followupUntil'),'follow-up speech must be queued even when the wake word is omitted');
assert.ok(ui.includes('if(!window.__wakeCommandActive)window.__wakeResponseReady?.();'),'wake-owned requests must leave listener recovery to the queue controller, avoiding competing resume loops');
assert.ok(!ui.includes('else if(window.__wakeCommandActive)setTimeout(()=>window.__wakeResponseReady?.(),0)'),'send() must not launch a second wake recovery while the queue controller is already recovering');
assert.ok(ui.includes('followupUntil=0;queue.push(q);'),'consuming a follow-up must clear the follow-up window');
assert.ok(ui.includes("status('🟡 Возобновляю слушание…');scheduleStart(150)"),'UI must not show a green listening state before Safari actually starts recognition');
assert.ok(ui.includes("status('🟢 Эй слушает — скажи «Эй» и вопрос',true)"),'green listening state must be set by the recognizer onstart event');
assert.ok(!ui.includes('<div class="actions"><button id="camAnalyze"'),'camera action buttons must live in the popup, not permanently below the preview');
const wakeE2E=fs.readFileSync('wake-buffer-e2e.mjs','utf8');
assert.ok(wakeE2E.includes("static commands=[['Эй','кто такой','Пётр Первый'],['кто такой','Пётр Первый'],['Эй','кто такой','Пётр Первый']];"),'hands-free E2E must cover a follow-up question without repeating the wake word');
console.log('SOURCE_SMOKE_OK');
