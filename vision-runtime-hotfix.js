const fs = require('fs');
const { execFileSync } = require('child_process');
const file = process.argv[2] || 'local-gateway.js';
let s = fs.readFileSync(file, 'utf8');
if (!s.includes('MISTRAL_PHOTO_MIDDLEWARE')) throw new Error('Direct Mistral vision middleware is missing');
if (!s.includes('GROQ_RESPONSES_VISION_MIDDLEWARE')) {
  const pos=s.indexOf("app.post('/photo'");
  if(pos<0) throw new Error('photo route marker not found');
  const mw="// GROQ_RESPONSES_VISION_MIDDLEWARE\napp.use('/photo',async(req,res,next)=>{\n  if(req.method!=='POST') return next();\n  try{\n    const key=keyOf('GROQ_API_KEY');\n    if(!key||Date.now()<groqBlockedUntil) return next();\n    const raw=Array.isArray(req.body?.images)?req.body.images:[req.body?.image];\n    const a=await Promise.all(raw.filter(Boolean).slice(0,3).map(normalizeVisionImage));\n    if(!a.length) return next();\n    const prompt=String(req.body?.prompt||'Опиши изображение подробно по-русски. Если это товар — определи бренд, модель и видимые характеристики. Не выдумывай неизвестное.').slice(0,3000);\n    const input=[{role:'user',content:[{type:'input_text',text:prompt},...a.map(url=>({type:'input_image',detail:'auto',image_url:url}))]}];\n    const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),15000);\n    try{\n      const r=await fetch('https://api.groq.com/openai/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:'qwen/qwen3.8-27b',input,max_output_tokens:512,reasoning:{effort:'none'}}),signal:ctl.signal});\n      const rawBody=await r.text();let d={};try{d=JSON.parse(rawBody)}catch{}\n      const result=String(d?.output_text||d?.output?.flatMap(x=>x?.content||[]).map(x=>x?.text||'').join('')||'').trim();\n      if(r.ok&&result)return res.json({ok:true,result,provider:'groq',model:'qwen/qwen3.8-27b'});\n      console.error('GROQ_RESPONSES_VISION_ERROR',r.status,String(d?.error?.message||rawBody).slice(0,500));\n      if(r.status===429){const msg=String(d?.error?.message||rawBody);const m=msg.match(/try again in\\s+([0-9]+(?:\\.[0-9]+)?)s/i);groqBlockedUntil=Date.now()+(m?Math.min(Math.ceil(Number(m[1])*1000)+5000,120000):15000)}else if(r.status===401||r.status===402)groqBlockedUntil=Date.now()+600000;\n      return next();\n    }finally{clearTimeout(tm)}\n  }catch(e){console.error('GROQ_RESPONSES_VISION_ERROR',e.message);groqBlockedUntil=Date.now()+15000;return next();}\n});\n";
  s=s.slice(0,pos)+mw+s.slice(pos);
}
try{execFileSync('systemctl',['daemon-reload'])}catch(e){console.error('VISION_SYSTEMD_DAEMON_RELOAD_ERROR',e.message)}
fs.writeFileSync(file,s);
console.log('VISION_PROVIDER_FALLBACK_V9_OK');
