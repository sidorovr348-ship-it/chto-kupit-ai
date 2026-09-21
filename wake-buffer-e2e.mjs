import { chromium } from 'playwright';

const APP='https://sidorovr348-ship-it.github.io/chto-kupit-ai/';
const API='https://ai.aliceq.ru';

(async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({
    viewport:{width:393,height:852},
    deviceScaleFactor:3,
    isMobile:true,
    hasTouch:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/18.7 Mobile/15E148 Safari/604.1'
  });

  await context.addInitScript(()=>{
    class FakeSpeechRecognition{
      static runs=0;
      constructor(){
        this.continuous=true;
        this.interimResults=false;
        this.lang='';
        this.onstart=null; this.onresult=null; this.onerror=null; this.onend=null;
      }
      start(){
        if(FakeSpeechRecognition.runs++) return;
        setTimeout(()=>this.onstart?.(),50);
        const emit=(transcript)=>{
          const result={0:{transcript},length:1,isFinal:true};
          this.onresult?.({resultIndex:0,results:[result]});
        };
        setTimeout(()=>emit('Эй'),150);
        setTimeout(()=>emit('сколько'),300);
        setTimeout(()=>emit('времени в Москве'),450);
      }
      stop(){setTimeout(()=>this.onend?.(),20)}
    }
    window.SpeechRecognition=FakeSpeechRecognition;
    window.webkitSpeechRecognition=FakeSpeechRecognition;
  });

  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  try{
    await page.goto(APP+'?wake-e2e='+Date.now(),{waitUntil:'networkidle',timeout:90000});
    await page.waitForFunction(()=>[...document.querySelectorAll('#chat .msg.ai')].some(x=>/Сейчас в Москве/.test(x.textContent||'')),null,{timeout:30000});
    const users=[...await page.locator('#chat .msg.user').allTextContents()];
    if(!users.some(x=>x.trim()==='сколько времени в Москве')) throw Error('wake command was not assembled as one complete phrase');
    if(errors.length) throw Error(errors.join('\n'));
    const apiCheck=await page.evaluate(async api=>(await (await fetch(api+'/health')).json()),API);
    if(!apiCheck.ok) throw Error('API health failed');
    console.log('WAKE_BUFFER_E2E_OK');
  } finally {
    await browser.close();
  }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
