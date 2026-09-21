import { chromium } from 'playwright';


const APP='https://sidorovr348-ship-it.github.io/chto-kupit-ai/';
const API='https://ai.aliceq.ru';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAYElEQVR4nO3PQQ0AIBDAMMC/50MEj4ZkVbDtmVk/OzrgVQNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgPaBXKqA31N0fbGAAAAAElFTkSuQmCC','base64');

(async()=>{
  for(let i=0;i<60;i++){
    try{
      const r=await fetch(API+'/health',{cache:'no-store'});
      const h=await r.json();
      const p=await fetch(APP+'?mobile-e2e='+Date.now(),{cache:'no-store'});
      const t=await p.text();
      if(r.ok&&h.ok&&t.includes('MediaRecorder')&&t.includes('EY_WAKE_WORD_V1')&&t.includes('commandBuffer')) break;
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
    permissions:['camera','microphone'],
    viewport:{width:393,height:852},
    deviceScaleFactor:3,
    isMobile:true,
    hasTouch:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/18.7 Mobile/15E148 Safari/604.1'
  });
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
  page.on('requestfailed',r=>errors.push('requestfailed: '+r.url()+' '+(r.failure()?.errorText||'')));

  try{
    await page.goto(APP+'?e2e='+Date.now(),{waitUntil:'networkidle',timeout:90000});
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
    await page.waitForFunction(n=>[...document.querySelectorAll('#chat .m.a,#chat .msg.ai')].slice(n).some(x=>(x.textContent||'').trim()&&!x.textContent.includes('⏳')),n,{timeout:30000});

    const cam=page.locator('#camera');
    await cam.tap();
    await page.waitForFunction(()=>{const v=document.querySelector('#cam');return v?.srcObject?.getVideoTracks?.()[0]?.readyState==='live'},null,{timeout:15000});
    await page.locator('#camOff').tap();
    await page.waitForFunction(()=>{const b=document.querySelector('#cameraBox');return b?.style.display==='none'},null,{timeout:5000});

    n=await before();
    const fcPromise=page.waitForEvent('filechooser');
    await page.locator('#photo').tap();
    const fc=await fcPromise;
    await fc.setFiles({name:'mobile.png',mimeType:'image/png',buffer:png});
    await page.waitForFunction(n=>[...document.querySelectorAll('#chat .m.a,#chat .msg.ai')].slice(n).some(x=>(x.textContent||'').trim()&&!x.textContent.includes('⏳')),n,{timeout:120000});

    const voice=page.locator('#voice');
    await voice.tap();
    await page.waitForFunction(()=>document.querySelector('#voice')?.classList.contains('recording'),null,{timeout:15000});
    await voice.tap();
    await page.waitForFunction(()=>!document.querySelector('#voice')?.classList.contains('recording'),null,{timeout:15000});

    const src=await page.content();
    for(const marker of ['interimResults=false','commandBuffer','/voice','navigator.geolocation','EY_WAKE_WORD_V1']) {
      if(!src.includes(marker)) throw Error('missing live source marker: '+marker);
    }

    let dialog=false;
    page.once('dialog',async d=>{dialog=true;await d.dismiss()});
    await page.locator('#imagegen').tap();
    await page.waitForTimeout(300);
    if(!dialog) throw Error('image prompt did not open');
    if(errors.length) throw Error(errors.join('\n'));
    await page.screenshot({path:'mobile-e2e.png',fullPage:true});
    console.log('MOBILE_E2E_OK');
  } finally {
    await browser.close();
  }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
