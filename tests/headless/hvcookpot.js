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
 const dawnSource=source('gameloop').split('function onNewDay(){')[1].split('// ── The regulars')[0];
 const soupAt=dawnSource.indexOf('soupNightAtDawn();'),cookAt=dawnSource.indexOf('if(G.workers.cook');
 ok(soupAt>=0&&soupAt<cookAt&&(dawnSource.match(/soupNightAtDawn\(\);/g)||[]).length===1,'soup serves exactly once before Cook');
 const ordered=['pantryAtDawn();','if(G.food<=0)','if(G.workers.scrapper','soupNightAtDawn();','if(G.workers.cook','if(G.structures.barrel','regularFavorsAtDawn();','if(G.dog===2)','repAtDawn();','muralAtDawn();','ticketAtDawn();','newcomerAtDawn();'];
 const positions=ordered.map(x=>dawnSource.indexOf(x));
 ok(positions.every((v,i)=>v>=0&&(!i||v>positions[i-1])),'other dawn steps retain their relative order');
 const dawn=async(opts={})=>page.evaluate(opts=>{
  G.days=5;G.lastEventDay=99;G.forecast=opts.weather||'clear';G.weather='clear';G.season=0;
  G.population=opts.pop||1;G.food=opts.food===undefined?4.5:opts.food;
  G.morale=50;G.health=80;G.warmth=80;G.goodwill=0;G.soupNights=0;G.goalIndex=GOALS.length;
  G.snapUntil=null;G.sickUntil=opts.sick?8:null;G.dog=opts.dog||1;G.dogMetDay=99;G.dogHungry=false;G.rep=0;
  G.regulars={marisol:0,ray:0,dee:0};G.workers.cook=opts.cook!==false;G.workers.scrapper=false;
  for(const k of Object.keys(G.structures))G.structures[k]=false;
  G.structures.soup_kitchen=opts.kitchen!==false;G.favor=null;G.mural=0;G.rayDebt=0;G.rainBetOn=false;G.friendDay=-1;
  document.querySelectorAll('.log-line').forEach(e=>e.remove());
  const original=Math.random;
  try {Math.random=()=>0.9;onNewDay();} finally {Math.random=original;}
  return {food:G.food,nights:G.soupNights,gw:G.goodwill,hungry:G.dogHungry,
   log:Array.from(document.querySelectorAll('.log-line')).map(e=>e.textContent).join(' ')};
 },opts);
 for(const opts of [{food:4.5},{food:7.5,pop:3},{food:3}]){
  const r=await dawn(opts);
  ok(r.nights===1&&/Soup night/.test(r.log)&&!/pot stayed cold/.test(r.log),'tight pot serves everyone: '+JSON.stringify(opts));
  ok(r.gw===0&&!/The Cook prepared meals/.test(r.log),'Cook leaves served pot alone when less than three remain');
 }
 const plenty=await dawn({food:10});
 ok(plenty.nights===1&&plenty.gw===2&&plenty.food===4.5&&plenty.log.indexOf('Soup night')<plenty.log.indexOf('The Cook prepared meals'),'ample pot serves soup then Cook');
 const none=await dawn({kitchen:false});
 ok(none.nights===0&&none.gw===2&&none.food===0&&/The Cook prepared meals/.test(none.log),'without kitchen Cook still breakfasts');
 const noCook=await dawn({cook:false});ok(noCook.nights===1&&noCook.food===2&&noCook.gw===0,'without Cook soup still serves');
 const heat=await dawn({weather:'heat',food:10});
 ok(heat.nights===0&&heat.gw===0&&heat.food===8.5&&/nobody wanted the pot fired/.test(heat.log)&&/Cook left the pot dark/.test(heat.log),'HV-264 and HV-277 heat skips both pots without spending');
 const sick=await dawn({sick:true,food:10});ok(sick.nights===1&&sick.gw===0&&/Cook is down with the bug/.test(sick.log),'HV-240 sick Cook still stands down');
 const dog=await dawn({dog:2,food:5.5});ok(dog.nights===1&&!dog.hungry&&dog.gw===0&&dog.food===2,'HV-208 Cook still leaves Biscuit a bowl after soup');

 ok(errors.length===0, 'zero page errors: '+errors.join('; '));
 } finally { await browser.close(); }
 console.log(`=== ${pass} passed, ${fail} failed ===`);
 process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
