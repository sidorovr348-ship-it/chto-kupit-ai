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
    const r=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:\`Bearer \${openai}\`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_IMAGE_MODEL||'gpt-image-1',prompt:p.slice(0,4000),size:process.env.OPENAI_IMAGE_SIZE||'1024x1024',quality:'auto'}),signal:AbortSignal.timeout(120000)}),d=await r.json().catch(()=>({}));
    if(!r.ok) throw Object.assign(Error(\`Генерация изображения: HTTP \${r.status}: \${String(d?.error?.message||'').slice(0,300)}\`),{status:r.status});
    const x=d?.data?.[0];
    if(!x) throw Error('Сервис изображений не вернул результат');
    return x.b64_json?{dataUrl:\`data:image/png;base64,\${x.b64_json}\`,provider:'openai'}:x.url?{url:x.url,provider:'openai'}:null;
  }
  const groq=keyOf('GROQ_API_KEY');
  if(groq){
    const system='Ты генератор SVG-иллюстраций. Создай ОДИН самодостаточный SVG 1024x1024 по описанию пользователя. Разрешены только обычные SVG-элементы: svg, rect, circle, ellipse, line, polyline, polygon, path, text, g, linearGradient, radialGradient, stop. Никаких script, image, iframe, foreignObject, внешних URL и обработчиков событий. Верни только полный SVG-код без markdown и пояснений. Сделай изображение визуально понятным и аккуратным.';
    const z=await provider('https://api.groq.com/openai/v1/chat/completions',groq,GROQ_TEXT_MODEL,[{role:'system',content:system},{role:'user',content:p.slice(0,3000)}],60000,false);
    let svg=String(z.text||'').trim().replace(/^\\s*\\\`\\\`\\\`(?:svg)?/i,'').replace(/\\\`\\\`\\\`\\s*$/,'').trim();
    if(!/^<svg\\b/i.test(svg)||!/<\\/svg>$/i.test(svg)) throw Error('Резервный генератор не вернул корректный SVG');
    if(/<script\\b|javascript:|<iframe\\b|<foreignObject\\b|on[a-z]+\\s*=/i.test(svg)) throw Error('Резервный SVG содержит запрещённый код');
    if(!/viewBox=/i.test(svg)) svg=svg.replace(/^<svg\\b/i,'<svg viewBox="0 0 1024 1024"');
    return {dataUrl:\`data:image/svg+xml;base64,\${Buffer.from(svg,'utf8').toString('base64')}\`,provider:'groq-svg',model:GROQ_TEXT_MODEL};
  }
  throw Object.assign(Error('Генерация изображений не настроена.'),{status:503});
}`;
s = s.slice(0,start) + replacement + s.slice(end);
s = s.replace(/imageGeneration:!!keyOf\('OPENAI_API_KEY'\)/, "imageGeneration:!!keyOf('OPENAI_API_KEY','GROQ_API_KEY')");
fs.writeFileSync(file,s);
console.log('IMAGE_GENERATION_FALLBACK_PATCH_OK');
