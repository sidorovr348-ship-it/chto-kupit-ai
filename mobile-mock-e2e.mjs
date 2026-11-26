import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';


const html=readFileSync(new URL('./smart-index.html',import.meta.url));
const server=createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const APP='http://127.0.0.1:'+server.address().port+'/smart-index.html';
const API='https://ai.aliceq.ru';
const mockChatRequests=[];
let mockTranscribeRequests=0,mockApiRequests=0,mockTtsRequests=0;
function silentWav(){const sampleRate=8000,samples=1600,dataBytes=samples*2,b=Buffer.alloc(44+dataBytes);b.write('RIFF',0);b.writeUInt32LE(36+dataBytes,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sampleRate,24);b.writeUInt32LE(sampleRate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(dataBytes,40);return b;}

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAYElEQVR4nO3PQQ0AIBDAMMC/50MEj4ZkVbDtmVk/OzrgVQNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgPaBXKqA31N0fbGAAAAAElFTkSuQmCC','base64');

(async()=>{
  const browser=await chromium.launch({headless:true,args:[
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required'
  ]});
  const context=await browser.newContext({
    permissions:['camera','microphone','geolocation'],
    geolocation:{latitude:55.7558,longitude:37.6173},
    viewport:{width:393,height:852},
    deviceScaleFactor:3,
    isMobile:true,
    hasTouch:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/27.2 Mobile/15E148 Safari/604.1'
  });
  const page=await context.newPage();
  await page.route('https://ai.aliceq.ru/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
    mockApiRequests++;
    const cors={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type,Authorization,X-Request-Id','cache-control':'no-store'};
    if(method==='OPTIONS')return route.fulfill({status:204,headers:cors});
    const json=value=>route.fulfill({status:200,headers:{...cors,'content-type':'application/json'},body:JSON.stringify(value)});
    if(path==='/health')return json({ok:true,dispatcher:true,adapters:{groq:true,search:true,tts:true,stt:true,documents:true,video:true,zip:true,imageGeneration:true}});
    if(path==='/autonomy/status')return json({ok:true,autonomy:{mode:'FULL_BOUNDED',initState:'ready'}});
    if(path==='/autonomy/self-check')return json({ok:true,coreConnected:true});
    if(path==='/transcribe'){mockTranscribeRequests++;return json({ok:true,text:'Кто такой Пётр Первый?'})}
    if(path==='/photo')return json({ok:true,result:'На тестовом изображении виден предмет. Это ответ имитированного сервера.'});
    if(path==='/tts'){mockTtsRequests++;return route.fulfill({status:200,headers:{...cors,'content-type':'audio/wav'},body:silentWav()})}
    if(path==='/chat'){
      let body={};try{body=request.postDataJSON()||{}}catch{}
      const prompt=String(body.prompt||body.messages?.filter(x=>x?.role==='user').at(-1)?.content||'').trim();
      mockChatRequests.push(prompt);
      if(/проверь резервный ответ/i.test(prompt))return json({ok:true,route:'chat',provider:'bounded-timeout-fallback',model:'deterministic',warning:'AI provider deadline exceeded',result:'Не удалось подготовить ответ вовремя. Автоматический повтор не запускался. Отправь вопрос ещё раз, если хочешь.',results:[],sources:[]});
      if(/п[её]тр.*перв/i.test(prompt))return json({ok:true,route:'chat',provider:'mock-provider',model:'mock',result:'Пётр Первый был российским императором. Он провёл масштабные реформы.'});
      if(/фотосинтез/i.test(prompt))return json({ok:true,route:'chat',provider:'mock-provider',model:'mock',result:'Фотосинтез — процесс, при котором растения используют солнечный свет, воду и углекислый газ для образования питательных веществ.'});
      if(/местоположени/i.test(prompt))return json({ok:true,route:'location',provider:'mock-geolocation',result:'Ваше текущее местоположение: Москва, тестовые координаты.',coordinates:{lat:55.7558,lon:37.6173},results:[],sources:[]});
      if(/кто ты|как тебя зовут/i.test(prompt))return json({ok:true,route:'chat',provider:'mock-provider',model:'mock',result:'Я Эй — My AI Unified, универсальный AI-помощник.'});
      if(/времени.*москв|москв.*время/i.test(prompt))return json({ok:true,route:'local-time',provider:'mock-clock',result:'Сейчас в Москве 12:34:56.'});
      return json({ok:true,route:'chat',provider:'mock-provider',model:'mock',result:'Это проверочный ответ имитированного сервера.'});
    }
    return json({ok:true,result:'Mock response',results:[],images:[],sources:[]});
  });
  const tapTool=async id=>{await page.locator('#toolsToggle').tap();await page.locator('#'+id).tap();};
  // Simulate Safari's SpeechRecognition lifecycle deterministically; this tests the app's
  // wake controller and repeated handoffs without pretending Chromium has real iOS speech.
  await page.addInitScript(() => {
    const instances=[];
    let primeArmed=false, permanentlyDeaf=false, primeCalls=0, synthSpeaking=false;
    class FakeUtterance {
      constructor(text){this.text=String(text||'');this.lang='';this.rate=1;this.pitch=1;this.volume=1;this.onend=null;this.onerror=null}
    }
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:FakeUtterance});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
      get speaking(){return synthSpeaking},
      get pending(){return false},
      getVoices(){return[]},
      cancel(){synthSpeaking=false},
      speak(utterance){
        primeCalls++;primeArmed=true;synthSpeaking=true;
        setTimeout(()=>{synthSpeaking=false;utterance.onend?.({type:'end'})},15);
      }
    }});
    class FakeRecognition {
      constructor(){this.started=false;this.lang='';this.continuous=false;this.interimResults=false;this.maxAlternatives=1;this.deaf=false;this.stopCalls=0;this.abortCalls=0;instances.push(this)}
      start(){
        if(this.started)throw new Error('recognizer already started');
        this.deaf=permanentlyDeaf||(instances.length>1&&!primeArmed);
        primeArmed=false;this.started=true;
        setTimeout(()=>this.onstart?.(),0);
      }
      stop(){this.stopCalls++;permanentlyDeaf=true;this.started=false;setTimeout(()=>this.onend?.(),0)}
      abort(){this.abortCalls++;permanentlyDeaf=true;this.started=false;setTimeout(()=>this.onend?.(),0)}
    }
    Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:FakeRecognition});
    Object.defineProperty(window,'webkitSpeechRecognition',{configurable:true,value:FakeRecognition});
    window.__fakeRecognitionInstances=instances;
    window.__fakeRecognitionState=()=>({primeCalls,permanentlyDeaf,stopCalls:instances.reduce((n,x)=>n+x.stopCalls,0),abortCalls:instances.reduce((n,x)=>n+x.abortCalls,0)});
    window.__fakeSpeak=(text)=>{
      const x=[...instances].reverse().find(v=>v.started);
      if(!x)throw new Error('no active simulated recognizer');
      if(x.deaf)return {deaf:true};
      x.onspeechstart?.({type:'speechstart'});
      const result={isFinal:true,0:{transcript:String(text)}};
      x.onresult?.({resultIndex:0,results:[result]});
      x.started=false;
      setTimeout(()=>x.onend?.(),0);
      return {deaf:false};
    };
  });;
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  // 5xx may be transient provider retries; UI operations below must still succeed.
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource: the server responded with a status of 5\d\d/i.test(m.text()))errors.push('console: '+m.text())});
  page.on('requestfailed',r=>errors.push('requestfailed: '+r.url()+' '+(r.failure()?.errorText||'')));

  try{
    await page.goto(APP+'?e2e='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});
    if(await page.title()!=='Эй') throw Error('wrong title');
    for(const id of ['send','voice','photo','camera','file','video','imagegen','sound','stop','clear']){
      if(await page.locator('#'+id).count()!==1) throw Error('missing control: '+id);
    }
    const health=await page.evaluate(async api=>(await (await fetch(api+'/health')).json()),API);
    if(!health.ok) throw Error('health failed');
    const status=await page.evaluate(async api=>(await (await fetch(api+'/autonomy/status')).json()),API);
    if(!status.ok||status.autonomy?.mode!=='FULL_BOUNDED') throw Error('autonomy status failed');

    const input=page.locator('#input');
    const send=page.locator('#send');
    const before=()=>page.locator('#chat .m.a,#chat .msg.ai').count();
    let n=await before();
    await input.fill('Кто ты? Ответь одним коротким предложением.');
    await send.click();
    await page.waitForFunction(n=>[...document.querySelectorAll('#chat .m.a,#chat .msg.ai')].slice(n).some(x=>(x.textContent||'').trim()&&!x.textContent.includes('⏳')),n,{timeout:75000});
    await page.waitForFunction(()=>window.__myAiBusy?.()===false,null,{timeout:75000});

    // Verify the two user-critical deterministic flows through the real mobile UI.
    n=await before();
    await input.fill('Сколько сейчас времени в Москве?');
    await send.click();
    try {
      await page.waitForFunction(n=>[...document.querySelectorAll('#chat .msg.ai')].slice(n).some(x=>/Сейчас в Москве/.test(x.textContent||'')),n,{timeout:30000});
    } catch (err) {
      const d = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        input: document.querySelector('#input')?.value || '',
        busy: window.__myAiBusy?.(),
        wakeStatus: document.querySelector('#wakeStatus')?.textContent || '',
        chat: [...document.querySelectorAll('#chat .msg')].slice(-10).map(x => ({ className: x.className, text: (x.textContent || '').slice(0, 300) })),
        sendCount: document.querySelectorAll('#send').length,
        sendDisabled: document.querySelector('#send')?.disabled
      }));
      throw Error('Moscow time UI timeout: ' + JSON.stringify({ ...d, errors: errors.slice(-10) }) + ' | ' + err.message);
    }
    await page.waitForFunction(()=>window.__myAiBusy?.()===false,null,{timeout:30000});

    n=await before();
    let locationPayload=null;
    const locationRequest=page.waitForRequest(req=>{
      if(!/ai\.aliceq\.ru\/chat$/i.test(req.url())||req.method()!=='POST') return false;
      try{
        const body=req.postDataJSON();
        if(body?.prompt==='Моё текущее местоположение'){locationPayload=body;return true;}
      }catch{}
      return false;
    });
    await input.fill('Моё текущее местоположение');
    await send.click();
    await locationRequest;
    if(!locationPayload?.location||!Number.isFinite(Number(locationPayload.location.lat))||!Number.isFinite(Number(locationPayload.location.lon))) throw Error('mobile geolocation coordinates were not sent to backend');
    await page.waitForFunction(n=>[...document.querySelectorAll('#chat .msg.ai')].slice(n).some(x=>/Ваше текущее местоположение|координаты|Точный адрес определить не удалось/.test(x.textContent||'')),n,{timeout:30000});
    const cam=page.locator('#camera');
    await tapTool('camera');
    await page.waitForFunction(()=>{const v=document.querySelector('#cam');return v?.srcObject?.getVideoTracks?.()[0]?.readyState==='live'},null,{timeout:15000});
    await tapTool('camOff');
    try {
      await page.waitForFunction(()=>{const v=document.querySelector('#cam');const b=document.querySelector('#cameraBox');return !v?.srcObject && getComputedStyle(b).display==='none'},null,{timeout:10000});
    } catch (err) {
      const d=await page.evaluate(()=>({cameraBoxDisplay:getComputedStyle(document.querySelector('#cameraBox')).display,videoHasStream:!!document.querySelector('#cam')?.srcObject,cameraButtonText:document.querySelector('#camera')?.textContent||'',cameraOffExists:!!document.querySelector('#camOff')}));
      throw Error('camera did not close: '+JSON.stringify(d)+' | '+err.message);
    }

    n=await before();
    const fcPromise=page.waitForEvent('filechooser');
    await tapTool('photo');
    const fc=await fcPromise;
    await fc.setFiles({name:'mobile.png',mimeType:'image/png',buffer:png});
    await page.waitForFunction(n=>[...document.querySelectorAll('#chat .m.a,#chat .msg.ai')].slice(n).some(x=>(x.textContent||'').trim()&&!x.textContent.includes('⏳')),n,{timeout:120000});

    await page.waitForFunction(()=>window.__myAiBusy?.()===false,null,{timeout:30000});
    await tapTool('voice');
    await page.waitForFunction(()=>window.__manualVoiceActive?.()===true,null,{timeout:15000});
    await page.waitForFunction(()=>window.__fakeRecognitionInstances?.some(x=>x.started),null,{timeout:20000});
    await page.evaluate(()=>window.__fakeSpeak('Кто такой Пётр Первый?'));
    await page.waitForFunction(()=>[...document.querySelectorAll('#chat .msg.user')].some(x=>/П[её]тр Первый/i.test(x.textContent||'')),null,{timeout:30000});
    if(mockTranscribeRequests!==0)throw Error('iOS manual dictation must use the active SpeechRecognition session, not a second getUserMedia capture; /transcribe calls='+mockTranscribeRequests);
    await page.waitForFunction(()=>window.__myAiBusy?.()===false,null,{timeout:30000});
    await page.waitForFunction(()=>window.__fakeRecognitionInstances?.some(x=>x.started),null,{timeout:20000});

    // A standalone wake word ends the current non-continuous recognizer. Do not claim
    // that the microphone is listening until a new recognizer actually starts.
    await page.waitForFunction(()=>window.__fakeRecognitionInstances?.some(x=>x.started),null,{timeout:20000});
    const wakeInstanceCount=await page.evaluate(()=>window.__fakeRecognitionInstances.length);
    await page.evaluate(()=>window.__fakeSpeak('Эй'));
    await page.waitForFunction(n=>window.__fakeRecognitionInstances?.length>n&&window.__fakeRecognitionInstances.some(x=>x.started),wakeInstanceCount,{timeout:20000});

    // Critical regression test: three consecutive wake questions, with the listener
    // required to return to a real started state after every answer.
    mockChatRequests.length=0;
    const wakeCases=[
      {spoken:'Эй, сколько времени в Москве?',answer:/Сейчас в Москве/},
      {spoken:'Эй, кто ты?',answer:/Я Эй — My AI Unified/},
      {spoken:'Эй, кто такой Пётр Первый?',answer:/П[её]тр|император|царь/i},
      {spoken:'Эй, объясни фотосинтез простыми словами',answer:/фотосинтез|солнечная фабрика|(?:делает|готовит) себе еду|из воздуха и света/iu},
      {spoken:'Эй, сколько времени в Москве?',answer:/Сейчас в Москве/}
    ];
    for(let i=0;i<wakeCases.length;i++){
      const item=wakeCases[i];
      await page.waitForFunction(()=>window.__fakeRecognitionInstances?.some(x=>x.started),null,{timeout:20000});
      const nAi=await page.locator('#chat .msg.ai').count();
      await page.evaluate(text=>window.__fakeSpeak(text),item.spoken);
      try {
        await page.waitForFunction(n=>[...document.querySelectorAll('#chat .msg.ai')].slice(n).some(x=>(x.textContent||'').trim()&&!((x.textContent||'').includes('⏳'))),nAi,{timeout:48000});
      } catch(err) {
        const state=await page.evaluate(n=>({
          newMessages:[...document.querySelectorAll('#chat .msg.ai')].slice(n).map(x=>(x.textContent||'').trim()).filter(Boolean),
          busy:window.__myAiBusy?.(),
          wakeStatus:document.querySelector('#wakeStatus')?.dataset.listening||null,
          recognizers:window.__fakeRecognitionInstances?.map(x=>({started:x.started,lang:x.lang}))||[]
        }),nAi);
        throw Error('wake question '+(i+1)+' produced no AI reply in 48s; state='+JSON.stringify(state)+'; '+err.message);
      }
      const actualReply=await page.locator('#chat .msg.ai').evaluateAll((els,n)=>els.slice(n).map(x=>(x.textContent||'').trim()).filter(Boolean).at(-1)||'',nAi);
      if(!new RegExp(item.answer.source,item.answer.flags).test(actualReply)) throw Error('wake question '+(i+1)+' answer mismatch; expected /'+item.answer.source+'/; actual='+actualReply.slice(0,800));
      await page.waitForFunction(()=>window.__myAiBusy?.()===false,null,{timeout:45000});
      await page.waitForFunction(()=>window.__fakeRecognitionInstances?.some(x=>x.started),null,{timeout:50000});
    }

    const serverPrompts=mockChatRequests.slice();
    if(serverPrompts.filter(x=>/п[её]тр.*перв/i.test(x)).length!==1)throw Error('one wake question must produce exactly one Peter-I chat request: '+JSON.stringify(serverPrompts));
    if(serverPrompts.filter(x=>/фотосинтез/i.test(x)).length!==1)throw Error('one wake question must produce exactly one photosynthesis chat request: '+JSON.stringify(serverPrompts));
    const speechState=await page.evaluate(()=>window.__fakeRecognitionState());
    if(speechState.stopCalls||speechState.abortCalls||speechState.permanentlyDeaf)throw Error('iOS recognizer must end naturally; stop/abort permanently poisons later sessions: '+JSON.stringify(speechState));
    if(speechState.primeCalls<5)throw Error('each iOS recognition session must be primed with speechSynthesis before start: '+JSON.stringify(speechState));

    // A degraded response must be labelled, must not trigger a duplicate retry,
    // and must not prevent the next hands-free command from running.
    await page.waitForFunction(()=>window.__fakeRecognitionInstances?.some(x=>x.started),null,{timeout:20000});
    const degradedStart=await page.locator('#chat .msg.ai').count();
    await page.evaluate(()=>window.__fakeSpeak('Эй, проверь резервный ответ'));
    await page.waitForFunction(n=>[...document.querySelectorAll('#chat .msg.ai')].slice(n).some(x=>(x.textContent||'').includes('Автоматический повтор не запускался')),degradedStart,{timeout:30000});
    if(!await page.locator('#chat .msg.ai').filter({hasText:'Основной AI-канал не ответил вовремя'}).count())throw Error('degraded timeout warning was not displayed');
    if(mockChatRequests.filter(x=>/проверь резервный ответ/i.test(x)).length!==1)throw Error('degraded timeout must not auto-retry the same request');
    await page.waitForFunction(()=>document.querySelector('#wakeStatus')?.dataset.listening==='true'&&window.__fakeRecognitionInstances?.some(x=>x.started),null,{timeout:30000});

    const src=await page.content();
    for(const marker of ['interimResults=false','let rec=null','function processQueue()','/chat','navigator.geolocation','EY_WAKE_WORD_V2_STATE_MACHINE']) {
      if(!src.includes(marker)) throw Error('missing live source marker: '+marker);
    }

    let dialog=false;
    page.once('dialog',async d=>{dialog=true;await d.dismiss()});
    await tapTool('imagegen');
    await page.waitForTimeout(300);
    if(!dialog) throw Error('image prompt did not open');
    if(mockApiRequests<8)throw Error('mock API was not used for all expected UI flows; intercepted='+mockApiRequests);
    if(mockTtsRequests<1)throw Error('TTS response path was not exercised; wake resumption after audio playback is unverified');
    if(errors.length) throw Error(errors.join('\n'));
    await page.screenshot({path:'mobile-e2e.png',fullPage:true});
    console.log('MOBILE_E2E_OK');
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
