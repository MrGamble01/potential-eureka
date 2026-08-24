const { chromium } = require('playwright');
const BASE='http://127.0.0.1:8099';
(async()=>{
  const b=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  const p=await ctx.newPage(); const errs=[];
  p.on('pageerror',e=>errs.push(e.message));
  const ck=(n,ok)=>console.log(`  ${ok?'PASS':'FAIL'}  ${n}`);

  // 1) Online visit installs the SW and fills the precache
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForTimeout(1500);
  const reg=await p.evaluate(async()=>{
    const r=await navigator.serviceWorker.ready;
    return {scope:r.scope, active:!!r.active};
  });
  ck('service worker active with root scope', reg.active && reg.scope.endsWith('/'));
  // wait for precache to finish (addAll of ~60 files incl. 1.9MB vendor)
  await p.waitForFunction(async()=>{
    const keys=await caches.keys();
    if(!keys.some(k=>k.includes('shell'))) return false;
    const c=await caches.open(keys.find(k=>k.includes('shell')));
    return (await c.keys()).length >= 55;
  },{timeout:30000});
  const cached=await p.evaluate(async()=>{
    const keys=await caches.keys();
    const c=await caches.open(keys.find(k=>k.includes('shell')));
    return (await c.keys()).length;
  });
  ck(`shell precached (${cached} entries)`, cached>=55);
  const manifest=await p.evaluate(()=>fetch('/manifest.json').then(r=>r.json()));
  ck('manifest served + parsable', manifest.name==='Eureka Games' && manifest.icons.length===2);

  // 2) Go OFFLINE. Hub must reload and the arcade must play.
  await ctx.setOffline(true);
  await p.reload({waitUntil:'load'});
  const title=await p.title();
  ck('hub reloads offline', /EUREKA|Eureka/i.test(title));
  await p.evaluate(()=>{location.hash='lightcycles';}); await p.waitForTimeout(900);
  await p.keyboard.press(' '); await p.waitForTimeout(1200);
  const playing=await p.evaluate(()=>document.getElementById('view-lightcycles').classList.contains('active'));
  ck('a game starts and runs offline', playing);

  // 3) Offline navigation to a 3D game page (vendored three.js from cache)
  await p.goto(BASE+'/drug-lab.html',{waitUntil:'load'});
  await p.waitForTimeout(5000);
  const lab=await p.evaluate(()=>({
    title:document.title,
    canvas:!!document.querySelector('canvas'),
    three:typeof window.__THREE_DEVTOOLS__!=='undefined'||!!document.querySelector('canvas'),
  }));
  ck('Grow Op page loads offline', /Grow Op|GROW/i.test(lab.title)||lab.canvas);
  ck('3D scene boots offline (three.js from cache)', lab.canvas);

  // 4) Clean-URL fallback: /drug-lab (no .html) while offline
  await p.goto(BASE+'/drug-lab',{waitUntil:'load'}).catch(()=>{});
  await p.waitForTimeout(2500);
  const clean=await p.evaluate(()=>!!document.querySelector('canvas'));
  ck('clean-URL navigation falls back to cached .html offline', clean);

  await ctx.setOffline(false);
  const fatalErrs = errs.filter(e=>!/Failed to fetch|NetworkError|Load failed/i.test(e));
  ck('no unexpected page errors', fatalErrs.length===0);
  if(fatalErrs.length) console.log('   ',fatalErrs.slice(0,4));
  await b.close();
})();
