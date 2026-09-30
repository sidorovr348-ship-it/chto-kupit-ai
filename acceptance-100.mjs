const API='https://ai.aliceq.ru';
const APP='https://ai.aliceq.ru/';
const TIMEOUT=25000;
let n=0,failed=0;const fail=[];
async function check(name,fn){n++;try{await fn();console.log('PASS',String(n).padStart(3,'0'),name)}catch(e){failed++;fail.push({n,name,error:String(e.message||e)});console.error('FAIL',String(n).padStart(3,'0'),name,e.message||e)}}
async function req(path,body,method='POST',timeout=TIMEOUT){const r=await fetch(API+path,{method,headers:body!==undefined?{'Content-Type':'application/json'}:undefined,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(timeout)});const t=await r.text();let j={};try{j=JSON.parse(t)}catch{}if(!r.ok)throw Error(path+' HTTP '+r.status+' '+t.slice(0,300));return j}
const ok=(x,m)=>{if(!x)throw Error(m)},textOf=x=>String(x?.result??x?.text??'').trim();

const staticChecks=[
['frontend reachable',async()=>ok((await fetch(APP+'?a=100')).ok,'frontend')],
['frontend title',async()=>ok((await (await fetch(APP+'?a=101')).text()).includes('<title>Эй</title>'),'title')],
['wake marker',async()=>ok((await (await fetch(APP+'?a=102')).text()).includes('EY_WAKE_WORD_V1'),'wake')],
['wake queue marker',async()=>{const html=await (await fetch(APP+'?a=103')).text();ok(html.includes('wakeQueue')&&html.includes('function pump()'),'wake queue')}],
['MediaRecorder marker',async()=>ok((await (await fetch(APP+'?a=104')).text()).includes('MediaRecorder'),'recorder')],
['geolocation marker',async()=>ok((await (await fetch(APP+'?a=105')).text()).includes('navigator.geolocation'),'geo')],
['generate-image marker',async()=>ok((await (await fetch(APP+'?a=106')).text()).includes('/generate-image'),'image')],
['window.send marker',async()=>ok((await (await fetch(APP+'?a=107')).text()).includes('window.send=send'),'send')],
['memory marker',async()=>ok((await (await fetch(APP+'?a=108')).text()).includes('memoryId'),'memory')],
['total chat deadline marker',async()=>ok((await (await fetch(APP+'?a=109')).text()).includes('const deadline=Date.now()+to'),'deadline')]
];
for(const [a,b] of staticChecks)await check(a,b);
for(let i=0;i<5;i++)await check('health '+(i+1),async()=>{const x=await req('/health',undefined,'GET');ok(x.ok&&x.service==='my-ai-unified','health')});
for(let i=0;i<5;i++)await check('autonomy status '+(i+1),async()=>{const x=await req('/autonomy/status',undefined,'GET');ok(x.ok&&x.autonomy,'autonomy')});
for(let i=0;i<5;i++)await check('autonomy self-check '+(i+1),async()=>{const x=await req('/autonomy/self-check',{},'POST',30000);ok(x.ok,'self-check')});
for(let i=0;i<5;i++)await check('autonomy chat task '+(i+1),async()=>{const x=await req('/autonomy/task',{kind:'chat',goal:'100-test '+i,input:{prompt:'Кто ты?'}},'POST',30000);ok(x.ok&&x.status==='ACCEPTED','task')});

for(const q of ['Сколько времени в Москве?','Который час в Москве?','Какое сейчас время в Москве?','Сколько сейчас часов в Москве?','Московское время сейчас?','Время в Москве','Скажи время в Москве','Который сейчас час в Москве?'])await check('Moscow time: '+q,async()=>{const x=await req('/chat',{prompt:q});ok(x.ok&&/\d{2}:\d{2}:\d{2}/.test(textOf(x)),'time')});
for(const q of ['Где я сейчас?','Моё текущее местоположение','Какая моя геолокация?','Определи моё местоположение'])await check('location without coords: '+q,async()=>{const x=await req('/chat',{prompt:q});ok(x.ok&&/геолокац|местополож/i.test(textOf(x)),'location fallback')});
for(const [lat,lon] of [[55.7558,37.6173],[55.7522,37.6156],[59.9343,30.3351],[40.7128,-74.006]])await check('location coords '+lat+','+lon,async()=>{const x=await req('/chat',{messages:[{role:'user',content:'Где я сейчас?'}],location:{lat,lon}});ok(x.ok&&x.route==='location'&&x.coordinates,'coords')});

for(const q of ['Кто такой Пётр Первый?','Кто такой Александр Пушкин?','Что такое фотосинтез?','Объясни простыми словами, что такое DNS.','Назови три планеты Солнечной системы.','Чем отличается SSD от HDD?','Что такое HTTP?','Как работает GPS?'])await check('chat: '+q,async()=>{const x=await req('/chat',{prompt:q});const min=q.includes('Пётр Первый')?120:10;ok(x.ok&&textOf(x).length>min,'answer too short')});
for(const q of ['OpenAI','новости технологий сегодня','погода Москва сегодня','курс евро к рублю','история Петра Первого','официальный сайт Apple','GitHub','последняя версия Node.js'])await check('search: '+q,async()=>{if(q==='погода Москва сегодня'){const x=await req('/chat',{prompt:q},'POST',35000);const t=textOf(x);ok(x.ok&&t.length>80&&/\d/.test(t),'weather answer must contain current numeric data')}else{const x=await req('/search',{query:q});ok(x.ok&&Array.isArray(x.results),'search')}});
for(let i=0;i<3;i++)await check('search repeat '+(i+1),async()=>{const x=await req('/search',{query:'OpenAI'});ok(x.ok&&Array.isArray(x.results),'repeat search')});

for(const [path,body] of [['/chat',{}],['/chat',{prompt:''}],['/photo',{}],['/generate-image',{prompt:''}],['/voice',{audio:''}],['/transcribe',{audio:''}],['/document',{}],['/search',{query:''}]])await check('negative '+path,async()=>{let failed=false;try{await req(path,body)}catch(e){failed=true;ok(!/ECONNRESET/i.test(e.message),'connection reset instead of controlled HTTP error')}ok(failed,'endpoint unexpectedly accepted invalid input')});
for(let i=0;i<3;i++)await check('identity '+(i+1),async()=>{const x=await req('/chat',{prompt:'Кто ты?'});ok(x.ok&&/Эй|My AI Unified/i.test(textOf(x)),'identity')});
for(let i=0;i<4;i++)await check('TTS '+(i+1),async()=>{const r=await fetch(API+'/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Проверка голоса '+i}),signal:AbortSignal.timeout(25000)});const b=Buffer.from(await r.arrayBuffer());ok(r.ok&&b.length>100,'tts')});
const p=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAYElEQVR4nO3PQQ0AIBDAMMC/50MEj4ZkVbDtmVk/OzrgVQNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgPaBXKqA31N0fbGAAAAAElFTkSuQmCC','base64').toString('base64');
for(let i=0;i<4;i++)await check('photo '+(i+1),async()=>{const x=await req('/photo',{images:['data:image/png;base64,'+p],prompt:'Опиши тестовое изображение.'},'POST',25000);ok(x.ok&&textOf(x).length>0,'photo')});
for(let i=0;i<4;i++)await check('sequential Peter '+(i+1),async()=>{const x=await req('/chat',{messages:[{role:'user',content:'Кто такой Пётр Первый?'}]},'POST',25000);ok(x.ok&&textOf(x).length>20,'Peter')});
const concurrent=await Promise.allSettled(Array.from({length:4},(_,i)=>req('/chat',{messages:[{role:'user',content:'Кратко: что такое HTTP? Запрос '+i}]})));
for(let i=0;i<4;i++)await check('concurrent '+(i+1),async()=>{const x=concurrent[i];if(x.status!=='fulfilled')throw Error('concurrent rejected: '+String(x.reason?.message||x.reason));if(!x.value?.ok)throw Error('concurrent bad response: '+JSON.stringify(x.value).slice(0,800));ok(textOf(x.value).length>5,'concurrent response too short')});
for(let i=0;i<4;i++)await check('wake prerequisites '+(i+1),async()=>{const h=await req('/health',undefined,'GET');ok(h.ok,'backend');const html=await (await fetch(APP+'?wake='+i)).text();ok(html.includes('EY_WAKE_WORD_V1')&&html.includes('wakeQueue')&&html.includes('function pump()'),'wake queue')});
for(let i=0;i<4;i++)await check('Moscow exact consistency '+(i+1),async()=>{const x=await req('/chat',{messages:[{role:'user',content:'Сколько времени в Москве?'}]});ok(/^Сейчас в Москве \d{2}:\d{2}:\d{2}\.$/.test(textOf(x)),'format')});

console.log('TOTAL',n,'FAILED',failed);
if(failed||n!==100){console.error(JSON.stringify(fail,null,2));process.exit(failed?1:2)}
console.log('ACCEPTANCE_100_OK');
