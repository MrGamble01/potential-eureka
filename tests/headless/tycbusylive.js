/* Exercise real timed offer and Board gates with browsing panels open.
 * The probe is injected into the served module only; no game hook ships.
 */
const {chromium}=require('playwright');
const assert=require('assert/strict');
const BASE=process.env.BASE||'http://127.0.0.1:8099';
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:880}});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    // Keep background production from introducing an unrelated offer.
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
    await page.route('**/tycoon/play.html',async route=>{
      const response=await route.fetch();let body=await response.text();
      const marker='requestAnimationFrame(loop);';const at=body.lastIndexOf(marker);
      assert(at>=0,'module probe insertion point exists');
      body=body.slice(0,at)+`
        window.__busyProbe=kind=>{
          if(kind==='acq'){
            closeAcqOffer(false,false);
            prestigeLevel=1; acquisitions=[]; acqNextT=0;
            updateAcq(1);
            return {offered:!!acqOffer,visible:document.getElementById('acq-offer').style.display==='block'};
          }
          boardNextT=0; updateBoard(1);
          return {offered:!!boardActive,visible:boardModalEl().classList.contains('open')};
        };
      `+body.slice(at);
      await route.fulfill({response,body});
    });
    await page.goto(BASE+'/tycoon/play.html',{waitUntil:'load'});
    await page.click('#welcome-start-btn');
    for(const id of ['wall-modal','help-modal','dash-modal','achievements-modal','elevator-modal']){
      if(id==='wall-modal')await page.click('#open-wall-btn');
      else await page.locator('#'+id).evaluate(el=>el.classList.add('open'));
      for(const kind of ['acq','board']){
        const result=await page.evaluate(k=>window.__busyProbe(k),kind);
        assert.deepEqual(result,{offered:false,visible:false},id+' blocks '+kind);
        console.log('PASS '+id+' blocks eligible '+kind+' without stacking');
      }
      await page.keyboard.press('Escape');
      assert(!(await page.locator('#'+id).evaluate(el=>el.classList.contains('open'))));
      const resumed=await page.evaluate(()=>window.__busyProbe('acq'));
      assert.deepEqual(resumed,{offered:true,visible:true},'offer resumes after '+id);
      await page.click('#acq-pass');
      const board=await page.evaluate(()=>window.__busyProbe('board'));
      assert.deepEqual(board,{offered:true,visible:true},'Board resumes after '+id);
      await page.click('#board-no');
      console.log('PASS closing '+id+' restores real acquisition and Board offers');
    }
    assert.deepEqual(errors,[]);console.log('PASS zero page errors; 16 checks');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
