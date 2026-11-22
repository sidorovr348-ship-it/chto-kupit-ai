'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ui=fs.readFileSync('smart-index.html','utf8');
const server=fs.readFileSync('legacy-server.js','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
test('Preview uses same-origin API',()=>assert.ok(ui.includes("location.hostname.endsWith('.vercel.app')?'':'https://ai.aliceq.ru'")));
test('voice uses dedicated transcription route',()=>{assert.ok(ui.includes("fetch(API+'/transcribe'"));assert.ok(ui.includes("setTimeout(()=>sttController.abort(),65000)"))});
test('Preview backend exposes Edge TTS',()=>{assert.ok(server.includes("app.post('/tts'"));assert.ok(server.includes("'Content-Type': 'audio/mpeg'"))});
test('weather supports GPS and typed city geocoding',()=>{assert.ok(ui.includes('const weatherIntent='));assert.ok(server.includes('if (isWeatherQuery(userPrompt) || req.body?.weatherLocation)')&&server.includes('geocoding-api.open-meteo.com'));assert.ok(server.includes('api.open-meteo.com/v1/forecast'))});
test('ordinary factual questions are routed to web search',()=>{const dispatcher=fs.readFileSync('src/dispatcher.js','utf8');assert.ok(dispatcher.includes('кто\\s+такой'));assert.ok(fs.readFileSync('local-gateway.js','utf8').includes('кто\\s+такой'))});
test('web search works without Serper key',()=>{assert.ok(server.includes('async function publicSearch'));assert.ok(server.includes('html.duckduckgo.com/html/'));assert.ok(server.includes('return publicSearch('))});
test('chat uses page scrolling rather than nested fixed-height scroll',()=>{assert.ok(ui.includes('.chat{height:auto;min-height:240px;max-height:none;overflow:visible'));assert.ok(ui.includes("d.scrollIntoView({block:'end',behavior:'smooth'})"))});
test('regression test is included in npm test',()=>assert.ok(pkg.scripts.test.includes('test-preview-mobile-fixes.js')));

test('Vercel video upload stays below the 4.5 MB function body cap after Base64 encoding',()=>assert.ok(ui.includes("location.hostname.endsWith('.vercel.app')?3000000:7000000")));
test('video UI consumes a valid server frame-analysis response instead of analyzing the same clip twice',()=>assert.ok(ui.includes("full?.available || (full?.ok&&full?.route==='video'&&String(full.result||'').trim())")));
test('Preview video route uses the Qwen Omni adapter and reports analysis mode truthfully',()=>{const route=fs.readFileSync('src/video-route.js','utf8');assert.ok(server.includes('createVideoRouteHandler'));assert.ok(route.includes("analysisMode: 'video_and_audio'"));assert.ok(route.includes("analysisMode: 'sampled_frames'"));assert.ok(route.includes('audioAnalyzed: false'))});

test('UI clearly labels a degraded local-model fallback instead of presenting it as a normal full answer',()=>assert.ok(ui.includes("if(j.warning)add('⚠️ Ответ сформирован резервной моделью. Он может быть менее подробным, чем обычно.')")));
