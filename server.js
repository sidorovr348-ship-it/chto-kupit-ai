require('dotenv').config({ path: process.env.ENV_FILE || '/root/chto-kupit-ai.env' });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { dispatch, getCapability } = require('./src/dispatcher');
const { diagnostics } = require('./supervisor');

const app = express();
const PORT = Number(process.env.PORT || 3020);
const PARALON_BASE_URL = process.env.PARALON_BASE_URL || 'https://paraloncloud.com/v1';
const PARALON_MODEL = process.env.PARALON_MODEL || 'qwen3.8-27b';
const MEDIA_ROOT = process.env.VERCEL ? '/tmp/my-ai-unified-media' : path.join(__dirname, 'media');
const INPUT_DIR = path.join(MEDIA_ROOT, 'input');
const TEMP_DIR = path.join(MEDIA_ROOT, 'temp');
for (const dir of [INPUT_DIR, TEMP_DIR]) fs.mkdirSync(dir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(__dirname));

const SYSTEM_PROMPT = `Ты — My AI Unified, единый универсальный AI-помощник пользователя. Отвечай на русском, если пользователь пишет по-русски. Не называй себя ChatGPT и не утверждай, что ты создан OpenAI. Не называй себя Qwen или Paralon: это внутренние технологии, через которые может работать My AI Unified. Если пользователь спрашивает «кто ты?», «как тебя зовут?» или аналогично, отвечай: «Я — My AI Unified, единый AI-помощник. Я умею общаться, искать информацию, анализировать фото и документы, работать с товарами, кодом и другими задачами.» Будь полезным, точным и честным; не выдумывай выполненные действия.`;

function configured(name) {
  if (name === 'paralon') return Boolean(process.env.PARALON_API_KEY);
  if (name === 'serper') return Boolean(process.env.SERPER_API_KEY);
  return false;
}
function textFromMessages(messages) { const last=[...messages].reverse().find(m=>m&&m.role==='user'); if(!last)return ''; if(typeof last.content==='string')return last.content; if(Array.isArray(last.content))return last.content.filter(x=>x?.type==='text').map(x=>x.text||'').join('\n'); return String(last.content||''); }
function withSystemPrompt(messages) { const clean=Array.isArray(messages)?messages.filter(m=>m?.role!=='system'):[]; return [{role:'system',content:SYSTEM_PROMPT},...clean]; }
async function callEmergencyTextFallback(messages) { const prompt=`${SYSTEM_PROMPT}\n\nПользователь:\n${textFromMessages(messages)}`; if(!textFromMessages(messages))throw Object.assign(new Error('Пустой запрос'),{status:400}); const response=await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`,{method:'GET',headers:{Accept:'text/plain'}}); const text=await response.text(); if(!response.ok||!text.trim()){const error=new Error('Emergency AI fallback failed');error.status=response.status||502;error.details=text.slice(0,500);throw error;} return text.trim(); }
async function callParalon(messages) { const safeMessages=withSystemPrompt(messages); if(!configured('paralon')){console.warn('PARALON_API_KEY missing; using emergency text AI fallback');return callEmergencyTextFallback(safeMessages);} const response=await fetch(`${PARALON_BASE_URL}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${process.env.PARALON_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:PARALON_MODEL,messages:safeMessages})}); const data=await response.json(); if(!response.ok){const error=new Error('Paralon request failed');error.status=response.status;error.details=data;throw error;} return data.choices?.[0]?.message?.content||''; }
async function searchWeb(query,location='Россия') { if(!configured('serper'))throw Object.assign(new Error('SERPER_API_KEY is not configured'),{status:503}); const response=await fetch('https://google.serper.dev/search',{method:'POST',headers:{'X-API-KEY':process.env.SERPER_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({q:`${query} ${location}`,gl:'ru',hl:'ru',num:6})}); const data=await response.json(); if(!response.ok)throw Object.assign(new Error('Web search failed'),{status:response.status,details:data}); return Array.isArray(data.organic)?data.organic.slice(0,6).map(item=>({title:item.title||'',url:item.link||'',content:item.snippet||''})):[]; }
function fallbackSearchAnswer(results){const items=(Array.isArray(results)?results:[]).filter(x=>x?.title||x?.content).slice(0,5);if(!items.length)return 'Поиск не вернул подходящих результатов.';return `Вот что нашёл в интернете:\n\n${items.map((x,i)=>`${i+1}. ${x.title||'Источник'}\n${x.content||'Без описания.'}${x.url?`\nИсточник: ${x.url}`:''}`).join('\n\n')}`;}
async function answerFromSearch(query,results,location='Россия'){const items=(Array.isArray(results)?results:[]).slice(0,5);const compact=items.map((x,i)=>`[${i+1}] ${x.title}\nURL: ${x.url}\nФрагмент: ${x.content}`).join('\n\n');if(!compact)return 'Поиск не вернул подходящих результатов.';const prompt=`Ты — My AI Unified. Кратко и по делу ответь пользователю на русском языке по результатам интернет-поиска ниже. Не выдумывай факты. Используй только эти результаты. Для важных утверждений ставь [номер источника]. В конце дай «Источники» и только использованные номера с названиями и URL. Не пиши технический JSON.\n\nЗапрос: ${query}\nРегион: ${location}\n\n${compact}`;const timeout=new Promise(resolve=>setTimeout(()=>resolve(null),12000));const synthesized=await Promise.race([callParalon([{role:'user',content:prompt}]),timeout]);return synthesized&&String(synthesized).trim()?String(synthesized).trim():fallbackSearchAnswer(results);}

async function serperRequest(endpoint, body, timeoutMs=15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://google.serper.dev/${endpoint}`, {
      method: 'POST',
      headers: {'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json'},
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {raw:text}; }
    if (!response.ok) {
      const error = new Error(`Serper ${endpoint} failed (${response.status})`);
      error.status = response.status;
      error.details = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      const e = new Error(`Serper ${endpoint} timeout`);
      e.status = 504;
      throw e;
    }
    throw error;
  } finally { clearTimeout(timer); }
}

function normalizeShoppingItem(item, index) {
  const priceText = item.price || item.priceText || '';
  const priceValue = Number(item.priceValue ?? item.extractedPrice ?? NaN);
  const source = item.source || item.merchant || '';
  const link = item.link || item.url || '';
  return {
    title: item.title || '',
    url: link,
    content: item.snippet || item.content || '',
    merchant: source,
    price: priceText,
    priceValue: Number.isFinite(priceValue) ? priceValue : null,
    currency: item.currency || 'RUB',
    availability: item.availability || '',
    rating: item.rating ?? null,
    ratingCount: item.ratingCount ?? null,
    imageUrl: item.imageUrl || item.image || '',
    position: index + 1
  };
}

async function searchShopping(query, location='Россия', mode='find') {
  if (!configured('serper')) throw Object.assign(new Error('SERPER_API_KEY is not configured'),{status:503});
  const cleanQuery = String(query).trim();
  const q = mode === 'cheaper' ? `${cleanQuery} купить дешевле ${location}` : `${cleanQuery} купить ${location}`;
  const data = await serperRequest('shopping', {q, gl:'ru', hl:'ru', num:20}, 15000);
  const items = Array.isArray(data.shopping) ? data.shopping : [];
  const allowed = ['ozon.ru','wildberries.ru','market.yandex.ru','dns-shop.ru','mvideo.ru','citilink.ru','aliexpress.ru','detmir.ru','eldorado.ru','holodilnik.ru','sbermegamarket.ru'];
  const normalized = items.map(normalizeShoppingItem).filter(x => x.title || x.price || x.merchant);
  const preferred = normalized.filter(x => allowed.some(domain => String(x.url||'').toLowerCase().includes(domain) || String(x.merchant||'').toLowerCase().includes(domain.replace('.ru',''))));
  return (preferred.length ? preferred : normalized).slice(0,10);
}

function runFfmpeg(args){return new Promise((resolve,reject)=>{execFile('ffmpeg',args,{timeout:30000},(error,stdout,stderr)=>{if(error)reject(Object.assign(error,{stderr}));else resolve({stdout,stderr});});});}
async function extractVideoFrames(inputFile){const stamp=`${Date.now()}-${Math.random().toString(36).slice(2)}`;const frameFiles=[path.join(TEMP_DIR,`frame-${stamp}-1.jpg`),path.join(TEMP_DIR,`frame-${stamp}-2.jpg`)];await Promise.all([runFfmpeg(['-y','-ss','0.6','-i',inputFile,'-frames:v','1','-vf','scale=320:180','-q:v','6',frameFiles[0]]),runFfmpeg(['-y','-ss','5.4','-i',inputFile,'-frames:v','1','-vf','scale=320:180','-q:v','6',frameFiles[1]])]);return frameFiles.filter(file=>fs.existsSync(file));}
async function analyzeVideo(images){const content=[{type:'text',text:'Проанализируй видео по выбранным кадрам. Опиши, что происходит, какие объекты и действия видны, и укажи важные детали.'}];for(const image of images)content.push({type:'image_url',image_url:{url:image}});return callParalon([{role:'user',content}]);}

app.get('/health',(req,res)=>{res.set('Cache-Control','no-store');res.json({ok:true,service:'my-ai-unified',dispatcher:true,adapters:{paralon:configured('paralon'),paralon_fallback:true,serper:configured('serper'),video:true},capabilities:Object.keys({chat:getCapability('chat'),vision:getCapability('vision'),image_generation:getCapability('image_generation'),video:getCapability('video'),web_search:getCapability('web_search'),documents:getCapability('documents'),tables:getCapability('tables'),shopping:getCapability('shopping'),voice:getCapability('voice'),code:getCapability('code'),verification:getCapability('verification')})});});
app.get('/diagnostics',async(req,res)=>{try{const result=await diagnostics();res.set('Cache-Control','no-store');res.json({ok:result.ok,route:'verification',result:result.ok?'Проверка завершена: сервер, интернет и тесты работают.':'Проверка завершена: обнаружена проблема.',diagnostics:result});}catch(error){res.status(500).json({ok:false,route:'verification',result:'Диагностика завершилась ошибкой.',error:error.message});}});
app.post('/chat',async(req,res)=>{try{const {prompt='',messages,hasImage=false,hasFile=false,hasVideo=false,location='Россия'}=req.body||{};const chatMessages=Array.isArray(messages)&&messages.length?messages:(prompt?[{role:'user',content:prompt}]:[]);const userPrompt=String(prompt||textFromMessages(chatMessages)).trim();if(!userPrompt&&!chatMessages.length)return res.status(400).json({ok:false,error:'prompt or messages is required'});const route=dispatch({prompt:userPrompt,hasImage,hasFile,hasVideo});if(route==='verification'){const result=await diagnostics();return res.json({ok:result.ok,route,result:result.ok?'Проверка завершена: критических проблем не обнаружено.':'Проверка завершена: обнаружена проблема. Автоматическое изменение кода без проверки запрещено.',diagnostics:result});}if(route==='shopping')return res.json({ok:true,route,results:await searchShopping(userPrompt,location,'find')});if(route==='web_search'){const results=await searchWeb(userPrompt,location);const result=await answerFromSearch(userPrompt,results,location);return res.json({ok:true,route,result,sources:results.slice(0,6).map(item=>({title:item.title,url:item.url})),model:PARALON_MODEL});}if(route==='code')return res.json({ok:true,route,result:await callParalon(chatMessages),model:PARALON_MODEL});if(route==='video')return res.json({ok:true,route,status:'routed',message:'Задача передана модулю видео.'});if(route==='documents')return res.json({ok:true,route,status:'routed',message:'Задача передана модулю документов.'});if(route!=='chat')return res.json({ok:true,route,status:'routed',message:`Задача передана модулю: ${route}.`});res.json({ok:true,route,result:await callParalon(chatMessages),model:configured('paralon')?PARALON_MODEL:'emergency-text-fallback'});}catch(error){console.error('CHAT ERROR:',error);res.status(error.status||500).json({ok:false,error:error.message||'AI request failed',details:error.details||undefined});}});

app.post('/photo',async(req,res)=>{try{const {prompt='Опиши изображение подробно.',image,images}=req.body||{};const inputImages=Array.isArray(images)?images:(image?[image]:[]);if(!inputImages.length)return res.status(400).json({ok:false,error:'image or images is required'});if(!configured('paralon'))return res.status(503).json({ok:false,error:'Для анализа фото сейчас нужен основной AI-ключ Paralon; аварийный текстовый режим работает для обычного чата.'});const content=[{type:'text',text:prompt}];for(const item of inputImages){const imageData=String(item).startsWith('data:')?item:`data:image/jpeg;base64,${item}`;content.push({type:'image_url',image_url:{url:imageData}});}res.json({ok:true,route:'vision',result:await callParalon([{role:'user',content}]),model:PARALON_MODEL});}catch(error){console.error('PHOTO ERROR:',error);res.status(error.status||500).json({ok:false,error:error.message||'Vision request failed'});}});
app.post('/video',async(req,res)=>{let inputFile=null,frameFiles=[];try{const raw=String(req.body?.video||req.body?.data||'');if(!raw)return res.status(400).json({ok:false,error:'video or data is required'});const base64=raw.includes(',')?raw.slice(raw.indexOf(',')+1):raw;inputFile=path.join(TEMP_DIR,`video-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);fs.writeFileSync(inputFile,Buffer.from(base64,'base64'));frameFiles=await extractVideoFrames(inputFile);if(!frameFiles.length)return res.status(502).json({ok:false,error:'Не удалось извлечь кадры видео'});const images=frameFiles.map(file=>`data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`);res.json({ok:true,route:'video',result:await analyzeVideo(images),frames:images.length,model:PARALON_MODEL});}catch(error){console.error('VIDEO ERROR:',error);res.status(error.status||502).json({ok:false,error:error.message||'Ошибка обработки видео'});}finally{if(inputFile){try{fs.unlinkSync(inputFile)}catch{}}for(const file of frameFiles){try{fs.unlinkSync(file)}catch{}}}});
app.post('/shopping',async(req,res)=>{try{const {query,location='Россия',mode='find'}=req.body||{};if(!query)return res.status(400).json({ok:false,error:'query is required'});res.json({ok:true,route:'shopping',mode,location,results:await searchShopping(query,location,mode)});}catch(error){console.error('SHOPPING ERROR:',error);res.status(error.status||500).json({ok:false,error:error.message||'Shopping request failed',details:error.details||undefined});}});
app.use((req,res,next)=>{if(req.method!=='GET'||req.path.startsWith('/api/'))return next();res.sendFile(path.join(__dirname,'index.html'));});
if(!process.env.VERCEL)app.listen(PORT,'127.0.0.1',()=>console.log(`My AI Unified API started on 127.0.0.1:${PORT}`));
module.exports=app;
