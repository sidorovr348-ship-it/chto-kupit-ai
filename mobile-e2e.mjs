import { chromium } from 'playwright';


const APP='https://ai.aliceq.ru/';
const API='https://ai.aliceq.ru';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAYElEQVR4nO3PQQ0AIBDAMMC/50MEj4ZkVbDtmVk/OzrgVQNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgPaBXKqA31N0fbGAAAAAElFTkSuQmCC','base64');

(async()=>{
  for(let i=0;i<60;i++){
    try{
      const r=await fetch(API+'/health',{cache:'no-store'});
      const h=await r.json();
      const p=await fetch(APP+'?mobile-e2e='+Date.now(),{cache:'no-store'});
      const t=await p.text();
      if(r.ok&&h.ok&&t.includes('MediaRecorder')&&t.includes('EY_WAKE_WORD_V2_STATE_MACHINE')&&t.includes('let rec=null')&&t.includes('function processQueue()')) break;
    }catch{}
    if(i===59) throw Error('Current production build was not exposed within 10 minutes');
    await new Promise(r=>setTimeout(r,10000));
  }

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
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/18.7 Mobile/15E148 Safari/604.1'
  });
  const page=await context.newPage();
  const tapTool=async id=>{await page.locator('#toolsToggle').tap();await page.locator('#'+id).tap();};
  // Simulate Safari's SpeechRecognition lifecycle deterministically; this tests the app's
  // wake controller and repeated handoffs without pretending Chromium has real iOS speech.
  await page.addInitScript(() => {
    const instances=[];
    class FakeRecognition {
      constructor(){this.started=false;this.lang='';this.continuous=false;this.interimResults=false;this.maxAlternatives=1;instances.push(this)}
      start(){if(this.started)throw new Error('recognizer already started');this.started=true;setTimeout(()=>this.onstart?.(),0)}
      stop(){this.started=false;setTimeout(()=>this.onend?.(),0)}
      abort(){this.started=false;setTimeout(()=>this.onend?.(),0)}
    }
    Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:FakeRecognition});
    Object.defineProperty(window,'webkitSpeechRecognition',{configurable:true,value:FakeRecognition});
    window.__fakeRecognitionInstances=instances;
    window.__fakeSpeak=(text)=>{
      const x=[...instances].reverse().find(v=>v.started);
      if(!x)throw new Error('no active simulated recognizer');
      const result={isFinal:true,0:{transcript:String(text)}};
      x.onresult?.({resultIndex:0,results:[result]});
      x.started=false;
      setTimeout(()=>x.onend?.(),0);
    };
  });
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  // 5xx may be transient provider retries; UI operations below must still succeed.
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource: the server responded with a status of 5\d\d/i.test(m.text()))errors.push('console: '+m.text())});
  page.on('requestfailed',r=>{const u=r.url();if(!/ai\.aliceq\.ru\/(photo|chat|tts|voice|transcribe|generate-image)/i.test(u))errors.push('requestfailed: '+u+' '+(r.failure()?.errorText||''))});

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

    const voice=page.locator('#voice');
    await tapTool('voice');
    await page.waitForFunction(()=>document.querySelector('#voice')?.classList.contains('recording'),null,{timeout:15000});
    await tapTool('voice');
    await page.waitForFunction(()=>!document.querySelector('#voice')?.classList.contains('recording'),null,{timeout:15000});

    // Critical regression test: three consecutive wake questions, with the listener
    // required to return to a real started state after every answer.
    const wakeCases=[
      {spoken:'Эй, сколько времени в Москве?',answer:/Сейчас в Москве/},
      {spoken:'Эй, кто ты?',answer:/Я Эй — My AI Unified/},
      {spoken:'Эй, кто такой Пётр Первый?',answer:/П[её]тр|император|царь/i},
      {spoken:'Эй, объясни фотосинтез простыми словами',answer:/фотосинтез|солнечная фабрика|делает себе еду/iu},
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
      await page.waitForFunction(()=>document.querySelector('#wakeStatus')?.dataset.listening==='true'&&window.__fakeRecognitionInstances?.some(x=>x.started),null,{timeout:50000});
    }

    const src=await page.content();
    for(const marker of ['interimResults=false','let rec=null','function processQueue()','/chat','navigator.geolocation','EY_WAKE_WORD_V2_STATE_MACHINE']) {
      if(!src.includes(marker)) throw Error('missing live source marker: '+marker);
    }

    let dialog=false;
    page.once('dialog',async d=>{dialog=true;await d.dismiss()});
    await tapTool('imagegen');
    await page.waitForTimeout(300);
    if(!dialog) throw Error('image prompt did not open');
    if(errors.length) throw Error(errors.join('\n'));
    await page.screenshot({path:'mobile-e2e.png',fullPage:true});
    console.log('MOBILE_E2E_OK');
  } finally {
    await browser.close();
  }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
