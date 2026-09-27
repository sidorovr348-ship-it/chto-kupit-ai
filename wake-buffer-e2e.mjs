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
      static commands=[['Эй','кто такой','Пётр Первый'],['Эй','кто такой','Пётр Первый'],['Эй','кто такой','Пётр Первый']];
      constructor(){
        this.continuous=true;
        this.ended=false;
        this.interimResults=false;
        this.lang='';
        this.onstart=null; this.onresult=null; this.onerror=null; this.onend=null;
      }
      stop(){if(this.ended)return;this.ended=true;setTimeout(()=>this.onend?.(),10)}
      abort(){if(this.ended)return;this.ended=true;setTimeout(()=>this.onend?.(),10)}
      start(){
        if(FakeSpeechRecognition.runs>=FakeSpeechRecognition.commands.length)return;
        const run=FakeSpeechRecognition.runs++;
        setTimeout(()=>this.onstart?.(),50);
        const emit=(transcript)=>{
          const result={0:{transcript},length:1,isFinal:true};
          this.onresult?.({resultIndex:0,results:[result]});
        };
        const command=FakeSpeechRecognition.commands[run];
        setTimeout(()=>emit(command.join(' ')),150);
        setTimeout(()=>this.onend?.(),1200);
      }
    }
    window.__wakeFake=FakeSpeechRecognition;
    Object.defineProperty(window,'SpeechRecognition',{configurable:true,writable:true,value:FakeSpeechRecognition});
    Object.defineProperty(window,'webkitSpeechRecognition',{configurable:true,writable:true,value:FakeSpeechRecognition});
  });

  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>{errors.push(e.message);});
  await page.exposeFunction('__wakeRecordError',m=>errors.push(String(m)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  try{
    await page.goto(APP+'?wake-e2e='+Date.now(),{waitUntil:'networkidle',timeout:90000});
    const sound=page.locator('#sound');
    if(await sound.count() && await sound.textContent()==='🔊 Звук') await sound.click();
    await page.locator('body').click({position:{x:196,y:400}});
    await page.waitForFunction(()=>typeof window.__wakeStart==='function',{timeout:10000});
    await page.evaluate(()=>window.__wakeStart());
    try{await page.waitForFunction(()=>window.__wakeFake?.runs>=1,null,{timeout:10000})}catch(err){const d=await page.evaluate(()=>({runs:window.__wakeFake?.runs,hasSR:!!window.SpeechRecognition,hasWakeStart:typeof window.__wakeStart,html:document.documentElement.innerHTML.includes('EY_WAKE_WORD_V1'),status:document.getElementById('wakeStatus')?.textContent||'',errors:window.__wakeTestErrors||[]}));throw Error('wake startup timeout: '+err.message+' | WAKE_START_DEBUG '+JSON.stringify(d));}
    for(let n=1;n<=3;n++){
      try{
        await page.waitForFunction((count)=>[...document.querySelectorAll('#chat .msg.user')].filter(x=>x.textContent?.trim()==='кто такой Пётр Первый').length>=count,n,{timeout:90000});
      }catch(err){
        const d=await page.evaluate(()=>({
          runs:window.__wakeFake?.runs,
          status:document.getElementById('wakeStatus')?.textContent||'',
          users:[...document.querySelectorAll('#chat .msg.user')].map(x=>x.textContent?.trim()),
          ais:[...document.querySelectorAll('#chat .msg.ai')].map(x=>x.textContent?.trim()),
          input:document.getElementById('input')?.value||'',
          busy:window.__myAiBusy?.()
        }));
        throw Error('wake cycle '+n+' timeout: '+err.message+' | WAKE_DEBUG '+JSON.stringify(d));
      }
      if(n<3) await page.waitForFunction((count)=>window.__wakeFake?.runs>=count,n+1,{timeout:90000});
    }
    const users=[...await page.locator('#chat .msg.user').allTextContents()];
    const wakeCommands=users.filter(x=>x.trim()==='кто такой Пётр Первый');
    if(wakeCommands.length<3) throw Error(`only ${wakeCommands.length} hands-free commands were assembled; fake recognition runs=${await page.evaluate(()=>window.__wakeFake?.runs)}`);
    await page.waitForFunction(()=>[...document.querySelectorAll('#chat .msg.ai')].filter(x=>x.textContent?.trim()).length>=4,null,{timeout:60000});
    if(errors.length) throw Error(errors.join('\n'));
    const apiCheck=await page.evaluate(async api=>(await (await fetch(api+'/health')).json()),API);
    if(!apiCheck.ok) throw Error('API health failed');
    console.log('WAKE_BUFFER_E2E_OK_3_CONSECUTIVE_COMMANDS');
  } finally {
    await browser.close();
  }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
