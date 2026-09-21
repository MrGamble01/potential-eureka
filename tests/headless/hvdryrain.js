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
 ok(source('player').includes("dryBuilt() && !drySat && G.weather!=='rain'"),'source gates roofed sits on rain');
 for(const weather of ['clear','cold','heat']){
  const r=await page.evaluate(weather=>{
   saveHvMark({names:3});saveHvDry({built:true,sits:0});drySat=false;
   G.weather=weather;G.food=10;G.cooldowns={};activeJobs={};
   document.querySelectorAll('.log-line').forEach(e=>e.remove());
   doAction(dryAction());
   const early=!activeJobs.dry&&!G.cooldowns.dry;
   finishAction(dryAction());
   return {early,food:G.food,sat:drySat,sits:loadHvDry().sits,log:Array.from(document.querySelectorAll('.log-line')).map(e=>e.textContent).join(' ')};
  },weather);
  ok(r.early&&r.food===10&&!r.sat&&r.sits===0,weather+' click and queued finish refuse without sit or food');
  ok(/today nobody is wet/.test(r.log),weather+' refusal explains the dry street');
 }
 const rain=await page.evaluate(()=>{
  G.weather='rain';G.cooldowns={};G.food=10;
  doAction(dryAction());const started=!!activeJobs.dry;delete activeJobs.dry;
  const dish=dryDish();finishAction(dryAction());
  const food=G.food;G.cooldowns={};doAction(dryAction());
  const refused=!activeJobs.dry&&!G.cooldowns.dry;finishAction(dryAction());
  return {started,dish,food,again:G.food,refused,sat:drySat,sits:loadHvDry().sits};
 });
 ok(rain.started&&rain.food===10+rain.dish&&rain.sat&&rain.sits===1,'rain sit queues and pays once');
 ok(rain.refused&&rain.again===rain.food,'HV-250 already-sat refusal remains');
 const roof=await page.evaluate(()=>{
  saveHvDry({built:false,sits:0});drySat=false;G.weather='clear';G.scraps=20;G.cardboard=20;G.food=10;G.cooldowns={};
  doAction(dryAction());const started=!!activeJobs.dry;delete activeJobs.dry;finishAction(dryAction());
  return {started,built:dryBuilt(),scraps:G.scraps,card:G.cardboard,food:G.food,sat:drySat};
 });
 ok(roof.started&&roof.built&&roof.scraps===8&&roof.card===12&&roof.food===10&&!roof.sat,'clear-sky roofing still queues and builds at normal cost');

 ok(errors.length===0, 'zero page errors: '+errors.join('; '));
 } finally { await browser.close(); }
 console.log(`=== ${pass} passed, ${fail} failed ===`);
 process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
