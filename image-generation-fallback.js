const fs = require('fs');
const file = process.argv[2] || 'local-gateway.js';
let s = fs.readFileSync(file, 'utf8');
const start = s.indexOf('async function generateImage(prompt){');
const end = s.indexOf('\nasync function transcribe(dataUrl){', start);
if (start < 0 || end < 0) throw new Error('generateImage function markers not found');
const replacement = `async function generateImage(prompt){
  const p=String(prompt||'').trim();
  if(!p) throw Object.assign(Error('Промпт для изображения пуст.'),{status:400});
  const openai=keyOf('OPENAI_API_KEY');
  if(openai){
    try{const r=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:\`Bearer \${openai}\`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_IMAGE_MODEL||'gpt-image-1',prompt:p.slice(0,4000),size:process.env.OPENAI_IMAGE_SIZE||'1024x1024',quality:'auto'}),signal:AbortSignal.timeout(120000)}),d=await r.json().catch(()=>({}));if(r.ok&&d?.data?.[0]){const x=d.data[0];return x.b64_json?{dataUrl:\`data:image/png;base64,\${x.b64_json}\`,provider:'openai'}:x.url?{url:x.url,provider:'openai'}:null;}}catch(e){console.error('OPENAI_IMAGE_ERROR',e.message)}}
  const system='Ты генератор SVG-иллюстраций. Создай ОДИН самодостаточный SVG 1024x1024 по описанию пользователя. Разрешены только обычные SVG-элементы: svg, rect, circle, ellipse, line, polyline, polygon, path, text, g, linearGradient, radialGradient, stop. Никаких script, image, iframe, foreignObject, внешних URL и обработчиков событий. Верни только полный SVG-код без markdown и пояснений.';
  const makeSvg=svg=>{svg=String(svg||'').trim().replace(/^\\s*\\\`\\\`\\\`(?:svg)?/i,'').replace(/\\\`\\\`\\\`\\s*$/,'').trim();if(!/^<svg\\b/i.test(svg)||!/<\\/svg>$/i.test(svg))throw Error('Некорректный SVG');if(/<script\\b|javascript:|<iframe\\b|<foreignObject\\b|on[a-z]+\\s*=/i.test(svg))throw Error('SVG содержит запрещённый код');if(!/viewBox=/i.test(svg))svg=svg.replace(/^<svg\\b/i,'<svg viewBox="0 0 1024 1024"');return {dataUrl:\`data:image/svg+xml;base64,\${Buffer.from(svg,'utf8').toString('base64')}\`,provider:'ai-svg'};};
  async function aiSvg(url,key,model,label){
    const r=await fetch(url,{method:'POST',headers:{Authorization:\`Bearer \${key}\`,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:p.slice(0,3000)}],temperature:0.2,max_tokens:4000}),signal:AbortSignal.timeout(60000)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw Error(label+' HTTP '+r.status+' '+JSON.stringify(d).slice(0,500));
    const text=d?.choices?.[0]?.message?.content||d?.choices?.[0]?.text||'';
    return {...makeSvg(text),model,provider:label};
  }
  const groq=keyOf('GROQ_API_KEY');
  if(groq){try{return await aiSvg('https://api.groq.com/openai/v1/chat/completions',groq,'openai/gpt-oss-20b','groq-ai-svg');}catch(e){console.error('GROQ_IMAGE_ERROR',e.message)}}
  const paralon=keyOf('PARALON_API_KEY','PARALON_KEY','PARALON_TOKEN');
  if(paralon){try{return await aiSvg('https://paraloncloud.com/v1/chat/completions',paralon,process.env.PARALON_IMAGE_MODEL||'qwen3.8-27b','paralon-ai-svg');}catch(e){console.error('PARALON_IMAGE_ERROR',e.message)}}
  const safe=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="white"/><circle cx="512" cy="430" r="230" fill="#d71920"/><path d="M320 720h384" stroke="#222" stroke-width="28" stroke-linecap="round"/></svg>','utf8').toString('base64');
  return {dataUrl:\`data:image/svg+xml;base64,\${safe}\`,provider:'svg-fallback'};
}`;
s = s.slice(0,start) + replacement + s.slice(end);
s = s.replace(/imageGeneration:!!keyOf\('OPENAI_API_KEY'(?:,'[^']*')*\)/, "imageGeneration:!!keyOf('OPENAI_API_KEY','GROQ_API_KEY','PARALON_API_KEY','PARALON_KEY','PARALON_TOKEN')");
s = s.replace(/imageGeneration:!!keyOf\('OPENAI_API_KEY'\)/, "imageGeneration:!!keyOf('OPENAI_API_KEY','GROQ_API_KEY','PARALON_API_KEY','PARALON_KEY','PARALON_TOKEN')");
s = s.replace("const models=vision?[GROQ_VISION_MODEL]:[GROQ_TEXT_MODEL,'openai/gpt-oss-20b','llama-3.1-8b-instant','llama-3.3-70b-versatile'];", "const models=vision?['qwen/qwen3.6-27b','qwen/qwen3.8-27b','meta-llama/llama-4-scout-17b-16e-instruct'].filter((v,i,a)=>a.indexOf(v)===i):[GROQ_TEXT_MODEL,'openai/gpt-oss-20b','llama-3.1-8b-instant','llama-3.3-70b-versatile'];");
s = s.replace("if(/^qwen\\/qwen3\\./i.test(model)){body.max_completion_tokens=700;body.temperature=.55;body.reasoning_effort='none';body.reasoning_format='hidden';delete body.max_tokens}", "if(/^qwen\\/qwen3\\./i.test(model)){body.max_completion_tokens=1024;body.temperature=.7;body.reasoning_effort='none';delete body.max_tokens;delete body.reasoning_format;delete body.include_reasoning}");
fs.writeFileSync(file,s);
console.log('IMAGE_GENERATION_FALLBACK_PATCH_OK');
console.log('VISION_FALLBACK_PATCH_OK');
