import { chromium } from 'playwright';

const APP='https://ai.aliceq.ru/';
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
      static commands=[['Эй','сколько','времени в Москве'],['Эй','сколько','времени в Москве'],['Эй','сколько','времени в Москве']];
      constructor(){
        this.continuous=true;
        this.interimResults=false;
        this.lang='';
        this.onstart=null; this.onresult=null; this.onerror=null; this.onend=null;
      }
      start(){
        const run=FakeSpeechRecognition.runs++;
        if(run>=FakeSpeechRecognition.commands.length){setTimeout(()=>this.onend?.(),20);return;}
        setTimeout(()=>this.onstart?.(),50);
        const emit=(transcript)=>{
          const result={0:{transcript},length:1,isFinal:true};
          this.onresult?.({resultIndex:0,results:[result]});
        };
        const command=FakeSpeechRecognition.commands[run];
        setTimeout(()=>emit(command[0]),150);
        setTimeout(()=>emit(command[1]),300);
        setTimeout(()=>emit(command[2]),450);
      }
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
    await page.waitForFunction(()=>[...document.querySelectorAll('#chat .msg.user')].filter(x=>x.textContent?.trim()==='сколько времени в Москве').length>=3,null,{timeout:60000});
    const users=[...await page.locator('#chat .msg.user').allTextContents()];
    const wakeCommands=users.filter(x=>x.trim()==='сколько времени в Москве');
    if(wakeCommands.length<3) throw Error(`only ${wakeCommands.length} hands-free commands were assembled`);
    await page.waitForFunction(()=>[...document.querySelectorAll('#chat .msg.ai')].filter(x=>/Сейчас в Москве/.test(x.textContent||'')).length>=3,null,{timeout:60000});
    if(errors.length) throw Error(errors.join('\n'));
    const apiCheck=await page.evaluate(async api=>(await (await fetch(api+'/health')).json()),API);
    if(!apiCheck.ok) throw Error('API health failed');
    console.log('WAKE_BUFFER_E2E_OK_3_CONSECUTIVE_COMMANDS');
  } finally {
    await browser.close();
  }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
