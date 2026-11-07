const test=require('node:test');
const assert=require('node:assert/strict');
const {health,isModelLoaded,OLLAMA_MODEL}=require('./src/local-ai');

test('Ollama health distinguishes installed model from loaded, ready model',async()=>{
 const originalFetch=global.fetch;
 try{
  global.fetch=async url=>{
   const path=String(url);
   if(path.endsWith('/api/tags'))return new Response(JSON.stringify({models:[{name:OLLAMA_MODEL}]}),{status:200,headers:{'content-type':'application/json'}});
   if(path.endsWith('/api/ps'))return new Response(JSON.stringify({models:[]}),{status:200,headers:{'content-type':'application/json'}});
   throw new Error('Unexpected Ollama endpoint '+path);
  };
  const cold=await health();
  assert.equal(cold.apiAvailable,true);
  assert.equal(cold.installed,true);
  assert.equal(cold.loaded,false);
  assert.equal(cold.ready,false);
  assert.equal(cold.ok,false);
  assert.match(cold.warning,/not loaded/i);
  assert.equal(await isModelLoaded(800),false);
  global.fetch=async url=>{
   const path=String(url);
   if(path.endsWith('/api/tags'))return new Response(JSON.stringify({models:[{name:OLLAMA_MODEL}]}),{status:200,headers:{'content-type':'application/json'}});
   if(path.endsWith('/api/ps'))return new Response(JSON.stringify({models:[{name:OLLAMA_MODEL}]}),{status:200,headers:{'content-type':'application/json'}});
   throw new Error('Unexpected Ollama endpoint '+path);
  };
  const warm=await health();
  assert.equal(warm.ready,true);
  assert.equal(warm.ok,true);
  assert.equal(await isModelLoaded(800),true);
 }finally{global.fetch=originalFetch}
});
