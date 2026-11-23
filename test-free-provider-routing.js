const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('local-gateway.js','utf8');

test('Cloudflare free provider endpoints and safe free-only gate are present',()=>{
  for(const marker of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','@cf/zai-org/glm-4.7-flash','@cf/meta/llama-4-scout-17b-16e-instruct','@cf/openai/whisper-large-v3-turbo',"if(AI_FREE_ONLY)"]) assert.ok(src.includes(marker), 'missing '+marker);
});

test('Requesty is opt-in and pinned to free model identifiers',()=>{
  for(const marker of ["REQUESTY_ALLOW_TRAINING_DATA==='1'",'nvidia/nemotron-3.5-lightning-30b-a3b','nvidia/nemotron-3-nano-omni-30b-a3b-reasoning']) assert.ok(src.includes(marker), 'missing '+marker);
});

test('Free-only mode masks legacy paid providers in health status',()=>{
  assert.ok(src.includes("openai:!AI_FREE_ONLY&&!!keyOf('OPENAI_API_KEY')"));
  assert.ok(src.includes("mistral:!AI_FREE_ONLY&&!!keyOf('MISTRAL_API_KEY')"));
  assert.ok(src.includes("groq:!AI_FREE_ONLY&&!!keyOf('GROQ_API_KEY')"));
  assert.ok(src.includes("if(AI_FREE_ONLY)throw Object.assign(Error('Генерация изображений отключена в бесплатном режиме"),'paid image generation must be blocked in free-only mode');
});
