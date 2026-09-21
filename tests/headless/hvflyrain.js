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
 const p=source('player');
 ok(p.includes('Rain pulped the flyers') && p.includes('gentrifyHostile()'), 'source names rain pulp and preserves hostility');
 const run=async(weather,early=false,hostile=false)=>page.evaluate(({weather,early,hostile})=>{
   G.days=1; G.oddJobDay=-1; G.weather=weather; G.gentrifyDay=hostile?1:-1;
   G.goodwill=10; G.morale=50; G.rep=10; G.structures.toolbox=weather==='rain';
   G.cooldowns={}; activeJobs={};
   document.querySelectorAll('.log-line').forEach(e=>e.remove());
   const before=JSON.stringify([G.food,G.energy,G.scraps,G.cans]);
   (early?doAction:finishAction)(oddJobAction());
   return {gw:G.goodwill,mo:G.morale,rep:G.rep,day:G.oddJobDay,job:!!activeJobs.oddjob,cd:G.cooldowns.oddjob,
     same:before===JSON.stringify([G.food,G.energy,G.scraps,G.cans]),log:document.querySelector('#log')?.textContent||Array.from(document.querySelectorAll('.log-line')).map(e=>e.textContent).join(' ')};
 },{weather,early,hostile});
 for(const early of [true,false]){
   const r=await run('rain',early);
   ok(r.gw===10&&r.mo===50&&r.rep===10&&r.same,'rain '+(early?'click':'finish')+' spends/pays nothing, including toolbox and Word');
   ok(r.day===1&&!r.job&&(!early||!r.cd),'rain stamps day; click burns no cooldown');
   ok(/Rain pulped the flyers/.test(r.log),'rain refusal names pulp');
 }
 const clear=await run('clear'); ok(clear.gw===13&&clear.mo===54&&clear.rep===14,'clear flyers pay and give kind Word');
 const cold=await run('cold'); ok(cold.gw===13&&cold.mo===54,'cold flyers still pay');
 const heat=await run('heat'); ok(heat.gw===12&&heat.mo===53,'heat preserves HV-250 reduction');
 const hostile=await run('clear',false,true); ok(hostile.gw===13&&hostile.mo===50&&hostile.rep===13,'hostile clear keeps pay but loses kindness');

 ok(errors.length===0, 'zero page errors: '+errors.join('; '));
 } finally { await browser.close(); }
 console.log(`=== ${pass} passed, ${fail} failed ===`);
 process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
