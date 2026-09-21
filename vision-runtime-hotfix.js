const fs = require('fs');
const { execFileSync } = require('child_process');
const file = process.argv[2] || 'local-gateway.js';
let s = fs.readFileSync(file, 'utf8');
if (!s.includes('MISTRAL_PHOTO_MIDDLEWARE')) throw new Error('Direct Mistral vision middleware is missing');
if (!s.includes('GROQ_RESPONSES_VISION_MIDDLEWARE')) {
  const pos=s.indexOf("app.post('/photo'");
  if(pos<0) throw new Error('photo route marker not found');
  const mw="// GROQ_RESPONSES_VISION_MIDDLEWARE\napp.use('/photo',async(req,res,next)=>{\n  if(req.method!=='POST') return next();\n  try{\n    const key=keyOf('GROQ_API_KEY');\n    if(!key) return next();\n    const raw=Array.isArray(req.body?.images)?req.body.images:[req.body?.image];\n    const a=await Promise.all(raw.filter(Boolean).slice(0,3).map(normalizeVisionImage));\n    if(!a.length) return next();\n    const prompt=String(req.body?.prompt||'Опиши изображение подробно по-русски. Если это товар — определи бренд, модель и видимые характеристики. Не выдумывай неизвестное.').slice(0,3000);\n    const input=[{role:'user',content:[{type:'input_text',text:prompt},...a.map(url=>({type:'input_image',detail:'auto',image_url:url}))]}];\n    const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),60000);\n    try{\n      const r=await fetch('https://api.groq.com/openai/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:'qwen/qwen3.8-27b',input}),signal:ctl.signal});\n      const rawBody=await r.text();let d={};try{d=JSON.parse(rawBody)}catch{}\n      const result=String(d?.output_text||d?.output?.flatMap(x=>x?.content||[]).map(x=>x?.text||'').join('')||'').trim();\n      if(r.ok&&result)return res.json({ok:true,result,provider:'groq',model:'qwen/qwen3.8-27b'});\n      console.error('GROQ_RESPONSES_VISION_ERROR',r.status,String(d?.error?.message||rawBody).slice(0,500));\n      return next();\n    }finally{clearTimeout(tm)}\n  }catch(e){console.error('GROQ_RESPONSES_VISION_ERROR',e.message);return next();}\n});\n";
  s=s.slice(0,pos)+mw+s.slice(pos);
}
try{execFileSync('systemctl',['daemon-reload'])}catch(e){console.error('VISION_SYSTEMD_DAEMON_RELOAD_ERROR',e.message)}
fs.writeFileSync(file,s);
console.log('VISION_PROVIDER_FALLBACK_V9_OK');
