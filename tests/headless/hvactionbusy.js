/* Craft/hire rebuilds must retain active action styling and click guards. */
const {chromium}=require('playwright');
const assert=require('assert/strict');
const BASE=process.env.BASE||'http://127.0.0.1:8099';
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:880}});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>localStorage.setItem('hv-intro-seen','1'));
    await page.goto(BASE+'/homeless-village.html',{waitUntil:'load'});
    const started=await page.evaluate(()=>{
      G.weather='clear';G.snapUntil=null;G.oddJobDay=-9;G.cooldowns={};
      doAction(ACTIONS.find(a=>a.id==='rest'));
      doAction(oddJobAction());
      return ['rest','oddjob'].every(id=>!!activeJobs[id]);
    });
    assert(started,'fixed and dynamic jobs both start');
    console.log('PASS fixed and dynamic jobs start');
    for(const rebuild of ['craft','hire']){
      const state=await page.evaluate(kind=>{
        const starts={rest:activeJobs.rest.startTime,oddjob:activeJobs.oddjob.startTime};
        if(kind==='craft'){
          G.activeCrafts.blanket={start:Date.now()-4000,duration:4000};
          finishCraft(RECIPES.find(r=>r.id==='blanket'));
        }else{G.goodwill=100;hireWorker('scrapper');}
        return ['rest','oddjob'].map(id=>{
          const b=document.getElementById('action-'+id);b.click();
          return {id,disabled:b.disabled,busy:b.classList.contains('active-job'),same:activeJobs[id].startTime===starts[id]};
        });
      },rebuild);
      for(const s of state){
        assert(s.disabled&&s.busy&&s.same,rebuild+' retains busy state for '+s.id);
        console.log('PASS '+rebuild+' rebuild retains '+s.id+' busy state and original job');
      }
    }
    await page.waitForFunction(()=>!activeJobs.rest&&!activeJobs.oddjob,null,{timeout:20000});
    await page.waitForTimeout(100);
    const completed=await page.evaluate(()=>({
      rest:!document.getElementById('action-rest').classList.contains('active-job')&&G.cooldowns.rest>Date.now(),
      odd:G.oddJobDay===G.days&&!document.getElementById('action-oddjob').classList.contains('active-job'),
      bars:['rest','oddjob'].every(id=>parseFloat(document.getElementById('progress-'+id).style.width)===0)
    }));
    assert(completed.rest&&completed.odd&&completed.bars,'normal completion clears busy state and progress while retaining cooldown/daily lock');
    console.log('PASS real completion restores normal cooldown, daily lock and empty bars');
    assert.deepEqual(errors,[]);console.log('PASS zero page errors; 7 checks');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
