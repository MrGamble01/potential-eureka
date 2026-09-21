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
 const donation=source('gameloop').split("id:'church_donation'")[1].split('];')[0];
 ok(/G\.cardboard/.test(donation)&&/stack of cardboard/.test(donation),'church source names cardboard grant and log');
 for(const roll of [0,0.999]){
 const r=await page.evaluate(roll=>{
  G.food=10; G.scraps=10; G.cardboard=10; G.morale=40; G.days=7; G.lastEventDay=-1;
  G.wood=17; G.cans=19;
  const original=Math.random;
  try { Math.random=()=>roll; EVENTS_GOOD.find(e=>e.id==='church_donation').effect(); }
  finally { Math.random=original; }
  return {food:G.food,scraps:G.scraps,card:G.cardboard,morale:G.morale,day:G.lastEventDay,wood:G.wood,cans:G.cans,
    log:Array.from(document.querySelectorAll('.log-line')).map(e=>e.textContent).join(' ')};
 },roll);
 ok(r.card===(roll===0?12:15),'donation cardboard bound at roll '+roll);
 ok(r.food===(roll===0?14:19)&&r.scraps===(roll===0?12:15)&&r.morale===(roll===0?45:50),'food, scraps and morale still granted');
 ok(r.day===7&&r.wood===17&&r.cans===19,'event stamp and unrelated resources remain correct');
 ok(/Food, scraps and cardboard gained/.test(r.log)&&/stack of cardboard/.test(r.log),'log names supplies and cardboard');
 }
 const cap=await page.evaluate(()=>{G.cardboard=undefined;G.morale=99;EVENTS_GOOD.find(e=>e.id==='church_donation').effect();return {card:G.cardboard,mo:G.morale};});
 ok(cap.card>=2&&cap.card<=5&&cap.mo===100,'missing cardboard initializes and morale caps at 100');

 ok(errors.length===0, 'zero page errors: '+errors.join('; '));
 } finally { await browser.close(); }
 console.log(`=== ${pass} passed, ${fail} failed ===`);
 process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
