const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('local-gateway.js','utf8');

test('Cloudflare free provider endpoints and safe free-only gate are present',()=>{
  assert.match(src,/CLOUDFLARE_ACCOUNT_ID/);
  assert.match(src,/CLOUDFLARE_API_TOKEN/);
  assert.match(src,/@cf\\/zai-org\\/glm-4\\.7-flash/);
  assert.match(src,/@cf\\/meta\\/llama-4-scout-17b-16e-instruct/);
  assert.match(src,/@cf\\/openai\\/whisper-large-v3-turbo/);
  assert.match(src,/if\\(AI_FREE_ONLY\\)/);
});

test('Requesty is opt-in and pinned to free model identifiers',()=>{
  assert.match(src,/REQUESTY_ALLOW_TRAINING_DATA==='1'/);
  assert.match(src,/nvidia\\/nemotron-3\\.5-lightning-30b-a3b/);
  assert.match(src,/nvidia\\/nemotron-3-nano-omni-30b-a3b-reasoning/);
});
