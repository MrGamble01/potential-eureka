// Hook-free regression coverage against production globals.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const source = name => fs.readFileSync(path.join(ROOT, 'homeless-village/js', name+'.js'), 'utf8');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass=0, fail=0;
const ok=(v,label)=>{ if(v) pass++; else fail++; console.log(`${v?'PASS':'FAIL'}  ${label}`); };
(async()=>{
 const browser=await chromium.launch({ ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH}:{}), args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
 try {
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{localStorage.setItem('hv-intro-seen','1');localStorage.removeItem('homeless_village_v1');});
 await page.goto(BASE+'/homeless-village.html');
 await page.waitForFunction(()=>typeof G!=='undefined' && typeof finishAction==='function');
 ok(source('gameloop').includes("log('They took the radio.')"),'sweep source names radio confiscation');
 const sweep=await page.evaluate(()=>{
  G.forecast='rain'; G.workers.lookout=false;
  for(const k of ['radio','tent','garden','pantry','coats','guitar','toolbox','stash']) G.structures[k]=true;
  EVENTS_BAD.find(e=>e.id==='sweep').effect();
  const hidden=!forecastVisible(); G.workers.lookout=true;
  return {s:{...G.structures},hidden,lookout:!!forecastVisible(),forecast:G.forecast,
    log:Array.from(document.querySelectorAll('.log-line')).map(e=>e.textContent).join(' ')};
 });
 ok(!sweep.s.radio&&sweep.hidden,'sweep takes radio and hides radio-only forecast');
 ok(/They took the radio\./.test(sweep.log),'sweep logs the radio');
 ok(sweep.lookout&&sweep.forecast==='rain','Lookout still sees the forecast without radio');
 ok(!sweep.s.tent&&!sweep.s.garden,'tent and garden still fall');
 ok(['pantry','coats','guitar','toolbox'].every(k=>!sweep.s[k]),'other confiscations coexist');
 ok(sweep.s.stash,'buried stash survives');
 const theft=await page.evaluate(()=>{
  G.structures.radio=true; G.workers.lookout=false; G.dog=0;
  EVENTS_BAD.find(e=>e.id==='theft').effect();
  return {radio:G.structures.radio,visible:!!forecastVisible(),log:Array.from(document.querySelectorAll('.log-line')).map(e=>e.textContent).join(' ')};
 });
 ok(!theft.radio&&!theft.visible&&/weather band/i.test(theft.log),'HV-248 theft still takes and names the weather band');

 ok(errors.length===0, 'zero page errors: '+errors.join('; '));
 } finally { await browser.close(); }
 console.log(`=== ${pass} passed, ${fail} failed ===`);
 process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
