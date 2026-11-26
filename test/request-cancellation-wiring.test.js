'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('chat client disconnect is propagated through dispatch, slot admission, and provider fetch', () => {
  const source = fs.readFileSync('local-gateway.js', 'utf8');
  assert.match(source, /const requestAbortController=new AbortController\(\)/, 'chat route must own a cancellation controller');
  assert.match(source, /if\(!res\.writableEnded\)requestAbortController\.abort\(new Error\('CHAT_CLIENT_DISCONNECTED'\)\)/, 'only a disconnected client may cancel active work');
  assert.match(source, /requestAbortController\.abort\(new Error\('CHAT_ROUTE_DEADLINE'\)\)/, 'server route deadline must stop the abandoned provider task');
  assert.match(source, /async function smartDispatch\(m,externalSignal=null\)/, 'dispatcher must accept the client signal');
  assert.match(source, /return ask\(m,false,externalSignal\)/, 'normal chat must pass cancellation to ask');
  assert.match(source, /async function askInternal\(messages,vision=false,externalSignal=null\)/, 'ask must accept cancellation');
  assert.match(source, /acquireTextSlot\(hardDeadline,externalSignal\)/, 'queued requests must be removable when the client disconnects');
  assert.match(source, /createProviderCancellation\(timeout,externalSignal\)/, 'provider fetch must combine client cancellation with its own timeout');
  assert.match(source, /cancellation\.source\(\)==='client'/, 'client cancellation must be distinguished from provider timeout');
  assert.ok(source.includes("catch(e){if(externalSignal?.aborted)throw createClientCancellationError();if(!vision&&e?.code!=='AI_PROVIDER_OUTPUT_TRUNCATED')textModelBlockedUntil.set(model,Date.now()+30000)"), 'client cancellation must not trip the provider model circuit breaker');
  assert.match(source, /callOllamaIfReady\(messages,\{numPredict:48,timeoutMs:Math\.min\(14500,remaining\(\)\),signal:externalSignal\}\)/, 'local fallback must receive the client signal');
  assert.match(source, /isModelLoaded\(800,options\.signal\|\|null\)/, 'local model readiness probe must also stop after client cancellation');
  const localSource = fs.readFileSync('src/local-ai.js', 'utf8');
  assert.match(localSource, /createProviderCancellation\(timeoutMs, options\.signal\)/, 'local Ollama fetch must combine its timeout with client cancellation');
  assert.match(source, /async function askMistralVisionFirst\(messages,externalSignal=null\)/, 'Mistral vision fallback must accept client cancellation');
  assert.match(source, /async function groqVisionResponses\(key,model,messages,timeout=30000,externalSignal=null\)/, 'Groq Responses vision fallback must accept client cancellation');
  assert.match(source, /groqVisionResponses\(groq,model,messages,30000,externalSignal\)/, 'vision fallback must forward the client signal');
  assert.match(source, /async function transcribe\(dataUrl,externalSignal=null\)/, 'STT provider must accept the request cancellation signal');
  assert.match(source, /transcribe\(body\.audio,sttAbortController\.signal\)/, 'transcribe route must forward client disconnect cancellation');
  assert.match(source, /transcribe\(String\(b\.audio\),requestAbortController\.signal\)/, 'chat audio transcription must share the chat request cancellation signal');
  assert.match(source, /async function searchWeb\(query,num=10,externalSignal=null\)/, 'search cache and provider chain must accept client cancellation');
  assert.match(source, /async function searchWebFallback\(query,num=10,externalSignal=null\)/, 'fallback search engines must accept client cancellation');
  assert.match(source, /async function readWebPage\(url,externalSignal=null\)/, 'page reader must accept client cancellation');
  assert.match(source, /async function enrichSearchResults\(items,externalSignal=null\)/, 'search result enrichment must forward cancellation');
  assert.match(source, /searchWeb\(q,10,externalSignal\),enriched=await enrichSearchResults\(a,externalSignal\)/, 'chat search must propagate the request signal through search and page reads');
  assert.match(source, /signal:signalWithTimeout\(8000,externalSignal\)/, 'fallback search fetches must combine provider timeout with client cancellation');
  assert.match(source, /app\.post\('\/search',async\(req,res\)=>\{const controller=new AbortController\(\)/, 'standalone search route must cancel its provider request on disconnect');
  assert.match(source, /app\.post\('\/document',async\(req,res\)=>\{const controller=new AbortController\(\)/, 'document route must own a cancellation controller');
  assert.match(source, /\],false,controller\.signal\)/, 'document AI analysis must receive the client cancellation signal');
});
