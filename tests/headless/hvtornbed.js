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
 ok(source('config').includes('The tent has to still be standing.'),'tooltip names standing-tent requirement');
 ok((source('gameloop').match(/lapseNewcomerNoTent\(\)/g)||[]).length===2,'wind and sweep each lapse the ask');
 const refuse=await page.evaluate(()=>{
  G.population=2;G.structures.tent=false;G.newcomerAsk={day:G.days};G.food=10;G.wood=10;G.morale=50;G.rep=60;
  G.cooldowns={};activeJobs={};document.querySelectorAll('.log-line').forEach(e=>e.remove());
  doAction(newcomerAction());const early=!activeJobs.newcomer&&!G.cooldowns.newcomer;
  finishAction(newcomerAction());
  return {early,pop:G.population,food:G.food,wood:G.wood,mo:G.morale,rep:G.rep,
   log:Array.from(document.querySelectorAll('.log-line')).map(e=>e.textContent).join(' ')};
 });
 ok(refuse.early&&refuse.pop===2&&refuse.food===10&&refuse.wood===10&&refuse.mo===50&&refuse.rep===60,'no tent: click and queued completion seat nobody or spend resources');
 ok(/no bed to offer/.test(refuse.log)&&!/A bed by the fire/.test(refuse.log),'refusal log is scoped and contains no welcome');
 const welcome=await page.evaluate(()=>{
  G.structures.tent=true;G.cooldowns={};document.querySelectorAll('.log-line').forEach(e=>e.remove());
  lapseNewcomerNoTent();const kept=!!G.newcomerAsk;
  finishAction(newcomerAction());finishAction(newcomerAction());
  return {kept,pop:G.population,food:G.food,wood:G.wood,ask:!!G.newcomerAsk,welcomes:G.welcomes,
   log:Array.from(document.querySelectorAll('.log-line')).map(e=>e.textContent).join(' ')};
 });
 ok(welcome.kept&&welcome.pop===3&&welcome.food===4&&welcome.wood===6&&!welcome.ask,'standing tent preserves ask and funded welcome seats once');
 ok((welcome.log.match(/A bed by the fire/g)||[]).length===1,'only successful welcome logs the bed');
 for(const event of ['wind','sweep']){
 const r=await page.evaluate(event=>{
  G.days=21;G.structures.tent=true;G.newcomerAsk={day:21};G.population=2;G.food=30;G.wood=10;
  G.forecast='clear';G.lastEventDay=26;G.dog=1;G.dogMetDay=99;G.rep=60;G.snapUntil=null;
  G.workers.cook=false;G.workers.scrapper=false;G.structures.garden=false;G.structures.workbench=false;
  document.querySelectorAll('.log-line').forEach(e=>e.remove());
  const original=Math.random;
  try {Math.random=()=>0;if(event==='wind') onNewDay();else EVENTS_BAD.find(e=>e.id==='sweep').effect();}
  finally {Math.random=original;}
  return {tent:G.structures.tent,ask:!!G.newcomerAsk,available:newcomerAvailable(),button:!!document.getElementById('action-newcomer'),
   log:Array.from(document.querySelectorAll('.log-line')).map(e=>e.textContent).join(' ')};
 },event);
 ok(!r.tent&&!r.ask&&!r.available&&!r.button,event+' removes tent, ask, and Make room action');
 ok(/stranger moved on/.test(r.log)&&!/A bed by the fire/.test(r.log),event+' names the lapsed ask without a welcome');
 }

 ok(errors.length===0, 'zero page errors: '+errors.join('; '));
 } finally { await browser.close(); }
 console.log(`=== ${pass} passed, ${fail} failed ===`);
 process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
