function buildActionUI(){
  var el=document.getElementById('action-list');
  hideTip(); // an item being hovered may be destroyed by innerHTML reset
  el.innerHTML='';
  ACTIONS.forEach(function(a){
    var btn=document.createElement('button');
    btn.className='action-btn'; btn.id='action-'+a.id;
    btn.setAttribute('data-tip',a.tooltip);
    btn.innerHTML='<span class="btn-progress" id="progress-'+a.id+'" style="width:0%"></span>'+a.icon+' '+a.label;
    btn.onclick=function(){ doAction(a); };
    btn.addEventListener('mouseenter',showTip);
    btn.addEventListener('mouseleave',hideTip);
    el.appendChild(btn);
  });
  // HV-8: today's bulletin-board posting rides at the bottom of the list
  var job=oddJobAction();
  var jb=document.createElement('button');
  jb.className='action-btn'; jb.id='action-oddjob';
  jb.setAttribute('data-tip', oddJobDone() ? 'Done for today — a new job is posted each morning.' : job.tooltip);
  jb.innerHTML='<span class="btn-progress" id="progress-oddjob" style="width:0%"></span>'+job.icon+' '+job.label+(oddJobDone()?' ✓':'');
  jb.disabled=oddJobDone();
  if(oddJobDone()) jb.style.opacity='.5';
  jb.onclick=function(){ doAction(oddJobAction()); };
  jb.addEventListener('mouseenter',showTip);
  jb.addEventListener('mouseleave',hideTip);
  el.appendChild(jb);
  // HV-11: the mural session appears once the neighborhood knows you,
  // and retires from the list when the fourth panel is up.
  if(muralAvailable()){
    var ma=muralAction();
    var mb=document.createElement('button');
    mb.className='action-btn'; mb.id='action-mural';
    mb.setAttribute('data-tip', muralDone() ? 'Today’s panel is drying — back at it tomorrow.' : ma.tooltip);
    mb.innerHTML='<span class="btn-progress" id="progress-mural" style="width:0%"></span>'+ma.icon+' '+ma.label+(muralDone()?' ✓':'');
    mb.disabled=muralDone();
    if(muralDone()) mb.style.opacity='.5';
    mb.onclick=function(){ doAction(muralAction()); };
    mb.addEventListener('mouseenter',showTip);
    mb.addEventListener('mouseleave',hideTip);
    el.appendChild(mb);
  }
  // HV-14: the meeting appears once the camp is more than one person,
  // and the circle rests a couple of days between sittings.
  if(meetingAvailable()){
    var ea=meetingAction();
    var eb=document.createElement('button');
    eb.className='action-btn'; eb.id='action-meeting';
    eb.setAttribute('data-tip', meetingDone() ? 'The camp met recently — the circle reconvenes in a day or two.' : ea.tooltip);
    eb.innerHTML='<span class="btn-progress" id="progress-meeting" style="width:0%"></span>'+ea.icon+' '+ea.label+(meetingDone()?' ✓':'');
    eb.disabled=meetingDone();
    if(meetingDone()) eb.style.opacity='.5';
    eb.onclick=function(){ doAction(meetingAction()); };
    eb.addEventListener('mouseenter',showTip);
    eb.addEventListener('mouseleave',hideTip);
    el.appendChild(eb);
  }
  // HV-20: the cart makes the daily deposit run possible.
  if(!!G.structures.cart){
    var dpa=depositAction();
    var dpb=document.createElement('button');
    dpb.className='action-btn'; dpb.id='action-deposit';
    var dpShort=(G.cans||0)<DEPOSIT_MIN;
    dpb.setAttribute('data-tip', depositDone() ? 'One load a day — the cart rests till dawn.'
      : dpShort ? 'Not worth the walk under '+DEPOSIT_MIN+' cans.' : dpa.tooltip);
    dpb.innerHTML='<span class="btn-progress" id="progress-deposit" style="width:0%"></span>'+dpa.icon+' '+dpa.label+(depositDone()?' ✓':'');
    dpb.disabled=depositDone()||dpShort;
    if(depositDone()||dpShort) dpb.style.opacity='.5';
    dpb.onclick=function(){ doAction(depositAction()); };
    dpb.addEventListener('mouseenter',showTip);
    dpb.addEventListener('mouseleave',hideTip);
    el.appendChild(dpb);
  }
  // HV-19: the guitar earns a daily set once it's built.
  if(buskAvailable()){
    var ba=buskAction();
    var bb=document.createElement('button');
    bb.className='action-btn'; bb.id='action-busk';
    bb.setAttribute('data-tip', buskDone() ? 'One set a day — the corner reopens at dawn.' : ba.tooltip);
    bb.innerHTML='<span class="btn-progress" id="progress-busk" style="width:0%"></span>'+ba.icon+' '+ba.label+(buskDone()?' ✓':'');
    bb.disabled=buskDone();
    if(buskDone()) bb.style.opacity='.5';
    bb.onclick=function(){ doAction(buskAction()); };
    bb.addEventListener('mouseenter',showTip);
    bb.addEventListener('mouseleave',hideTip);
    el.appendChild(bb);
  }
  // HV-21: the newcomer's ask appears only while someone waits at the edge of the light.
  if(newcomerAvailable()){
    var nca=newcomerAction();
    var ncb=document.createElement('button');
    ncb.className='action-btn'; ncb.id='action-newcomer';
    var ncShort=G.food<NEWCOMER_COST_FOOD||G.wood<NEWCOMER_COST_WOOD;
    ncb.setAttribute('data-tip', ncShort ? 'A bed takes '+NEWCOMER_COST_FOOD+' food and '+NEWCOMER_COST_WOOD+' wood.' : nca.tooltip);
    ncb.innerHTML='<span class="btn-progress" id="progress-newcomer" style="width:0%"></span>'+nca.icon+' '+nca.label;
    ncb.disabled=ncShort;
    if(ncShort) ncb.style.opacity='.5';
    ncb.onclick=function(){ doAction(newcomerAction()); };
    ncb.addEventListener('mouseenter',showTip);
    ncb.addEventListener('mouseleave',hideTip);
    el.appendChild(ncb);
  }
  // HV-17: the bus ticket appears only while a resident's ask is open.
  if(ticketAvailable()){
    var tka=ticketAction();
    var tkb=document.createElement('button');
    tkb.className='action-btn'; tkb.id='action-ticket';
    tkb.setAttribute('data-tip', tka.tooltip);
    tkb.innerHTML='<span class="btn-progress" id="progress-ticket" style="width:0%"></span>'+tka.icon+' '+tka.label;
    tkb.onclick=function(){ doAction(ticketAction()); };
    tkb.addEventListener('mouseenter',showTip);
    tkb.addEventListener('mouseleave',hideTip);
    el.appendChild(tkb);
  }
  // HV-53: the dry corner opens once three names are up, and the one
  // button changes what it is the moment the roof goes on.
  if(dryAvailable()){
    var dya=dryAction();
    var dyb=document.createElement('button');
    dyb.className='action-btn'; dyb.id='action-dry';
    dyb.setAttribute('data-tip', dya.tooltip);
    var dyDone=G.dryDay===G.days;
    dyb.innerHTML='<span class="btn-progress" id="progress-dry" style="width:0%"></span>'+dya.icon+' '+dya.label+(dyDone&&dryBuilt()?' \u2713':'');
    if(dyDone&&dryBuilt()){ dyb.disabled=true; dyb.style.opacity='.5'; }
    dyb.onclick=function(){ doAction(dryAction()); };
    dyb.addEventListener('mouseenter',showTip);
    dyb.addEventListener('mouseleave',hideTip);
    el.appendChild(dyb);
  }
}

function buildCraftUI(){
  var el=document.getElementById('craft-list');
  hideTip(); // an item being hovered may be destroyed by innerHTML reset
  el.innerHTML='';
  RECIPES.forEach(function(r){
    var div=document.createElement('button');
    div.type='button';
    div.className='craft-item'+(canCraft(r)?'':' cant-afford');
    div.id='craft-'+r.id;
    var costStr=Object.entries(r.cost).map(function(e){return e[1]+e[0];}).join(' ');
    div.innerHTML='<span class="ci-icon">'+r.icon+'</span><div class="ci-info"><span class="ci-name">'+r.name+'</span><span class="ci-cost">'+costStr+'</span></div>';
    var tipText=r.desc;
    if(r.requires && !G.structures[r.requires]) tipText+=' Requires a '+r.requires.replace('_',' ')+'.';
    div.setAttribute('data-tip',tipText);
    div.onclick=function(){ doCraft(r); };
    div.addEventListener('mouseenter',showTip);
    div.addEventListener('mouseleave',hideTip);
    div.addEventListener('focus',showTip);
    div.addEventListener('blur',hideTip);
    el.appendChild(div);
    // Rebuilds discard the busy styling doCraft applied to the old
    // node — re-apply it so an in-flight recipe stays locked.
    if(G.activeCrafts && G.activeCrafts[r.id]) markCraftBusy(r.id,true);
  });
}

function markCraftBusy(id,busy){
  var el=document.getElementById('craft-'+id);
  if(el){ el.style.opacity=busy?'.5':''; el.style.pointerEvents=busy?'none':''; }
}

function buildWorkersUI(){
  var el=document.getElementById('workers-list');
  el.innerHTML='';
  WORKER_DEFS.forEach(function(w){
    var hired=G.workers[w.id];
    var row=document.createElement('div');
    row.className='worker-row'+(hired?' hired':'');
    if(hired){
      row.innerHTML='<span class="w-icon">'+w.icon+'</span><span class="w-name">'+w.name+'</span><span class="w-status">active</span>';
    } else {
      row.innerHTML='<span class="w-icon">'+w.icon+'</span><span class="w-name">'+w.name+'</span><button class="w-hire" onclick="hireWorker(\''+w.id+'\')" title="'+w.desc+'">'+w.cost+'🩶</button>';
    }
    el.appendChild(row);
  });
  buildPetitionsUI();  // HV-15: the notice board rides the same panel
  buildRegularsUI();   // HV-7: the roster shares the Community panel
  buildFavorUI();      // HV-16: a friend's ask rides under the roster
}

// HV-16: the open favor renders as one row with a Give button that
// stays disabled until the goods are actually to spare.
function buildFavorUI(){
  var el=document.getElementById('regulars-list');
  if(!el||!G.favor) return;
  var f=FAVORS[G.favor.who], r=regularDef(G.favor.who);
  if(!f||!r) return;
  var can=Object.entries(f.need).every(function(e){ return (G[e[0]]||0)>=e[1]; });
  var needStr=Object.entries(f.need).map(function(e){ return e[1]+({cans:'\ud83e\udee9',food:'\ud83c\udf5e',scraps:'\ud83e\uddf1'}[e[0]]||(' '+e[0])); }).join(' ');
  var row=document.createElement('div');
  row.className='worker-row';
  row.innerHTML='<span class="w-icon">'+r.icon+'</span><span class="w-name">'+r.name+' asks: '+needStr+'</span><button class="w-hire" onclick="doFavor()"'+(can?'':' disabled')+'>Give</button>';
  row.setAttribute('data-tip',f.ask+' Friends pay it back in goodwill.');
  row.addEventListener('mouseenter',showTip);
  row.addEventListener('mouseleave',hideTip);
  el.appendChild(row);
}

// HV-15: the petitions board appears once the city will read them
// (Respected+). Won petitions collapse into a checked row.
function buildPetitionsUI(){
  var el=document.getElementById('workers-list');
  if(!el||!petitionsAvailable()) return;
  var head=document.createElement('div');
  head.className='worker-row';
  head.innerHTML='<span class="w-icon">📋</span><span class="w-name"><b>City petitions</b></span>';
  el.appendChild(head);
  PETITIONS.forEach(function(p){
    var won=G.petitions[p.id];
    var row=document.createElement('div');
    row.className='worker-row'+(won?' hired':'');
    if(won){
      row.innerHTML='<span class="w-icon">'+p.icon+'</span><span class="w-name">'+p.name+'</span><span class="w-status">won ✓</span>';
    } else {
      row.innerHTML='<span class="w-icon">'+p.icon+'</span><span class="w-name">'+p.name+'</span><button class="w-hire" onclick="doPetition(\''+p.id+'\')" title="'+p.desc+'">'+p.cost+'🩶</button>';
    }
    row.setAttribute('data-tip',p.desc);
    row.addEventListener('mouseenter',showTip);
    row.addEventListener('mouseleave',hideTip);
    el.appendChild(row);
  });
}

// HV-7: the regulars roster under the Community panel. Hearts fill with
// affinity; the row's tooltip explains how to earn it and what a friend
// does for the camp.
function buildRegularsUI(){
  var el=document.getElementById('regulars-list');
  if(!el) return;
  el.innerHTML='';
  REGULARS.forEach(function(r){
    var a=(G.regulars&&G.regulars[r.id])||0, st=regularStage(r.id);
    var row=document.createElement('div');
    row.className='worker-row'+(st===2?' hired':'');
    var hearts='';
    for(var i=0;i<5;i++) hearts+=a>=(i+1)*2?'♥':'♡';
    row.innerHTML='<span class="w-icon">'+r.icon+'</span>'+
      '<span class="w-name">'+(st===0?'???':r.name)+'</span>'+
      '<span class="w-status" style="letter-spacing:2px">'+hearts+'</span>';
    row.setAttribute('data-tip',(st===0?'Someone '+r.who+'. ':r.name+' '+r.who+'. ')+r.how+'. Friends: '+r.perk+'.');
    row.addEventListener('mouseenter',showTip);
    row.addEventListener('mouseleave',hideTip);
    el.appendChild(row);
  });
}

function canCraft(r){
  // A permanent structure that's already built can't be crafted again.
  if(r.gives && r.gives.structure && G.structures[r.gives.structure]) return false;
  // Workbench-gated "crafting upgrades" (Tent, Soup Kitchen, Garden) stay
  // locked until the Workbench structure actually exists.
  if(r.requires && !G.structures[r.requires]) return false;
  return Object.entries(r.cost).every(function(e){ return G[e[0]]>=e[1]; });
}

function currentGoal(){ return G.goalIndex<GOALS.length ? GOALS[G.goalIndex] : null; }

function checkGoals(){
  var g=currentGoal();
  // while, not if: an old save (or a big day) can satisfy several
  // goals at once, and each one should still pay out and be logged.
  while(g && g.value()>=g.target){
    G.goalIndex++; G.goodwill+=g.reward;
    log('Goal complete: '+g.desc+'. +'+g.reward+' goodwill.');
    floatText('+'+g.reward+'🩶');
    sfx('goal');
    saveGame();
    g=currentGoal();
  }
}

function updateGoalHUD(){
  var g=currentGoal(), el=document.getElementById('goal-text');
  if(!g){ el.textContent='All goals complete'; return; }
  el.textContent=g.desc+' ('+Math.min(g.value(),g.target)+'/'+g.target+')';
}

function updateHUD(){
  checkGoals(); updateGoalHUD();
  document.getElementById('stat-food').textContent    =Math.floor(G.food);
  document.getElementById('stat-scraps').textContent  =Math.floor(G.scraps);
  document.getElementById('stat-cans').textContent    =Math.floor(G.cans);
  document.getElementById('stat-goodwill').textContent=Math.floor(G.goodwill);
  document.getElementById('stat-health').textContent  =Math.floor(G.health);
  document.getElementById('stat-warmth').textContent  =Math.floor(G.warmth);
  document.getElementById('morale-val').textContent   =Math.floor(G.morale);
  document.getElementById('pop-val').textContent      =G.population+(G.dog===2?(G.dogHungry?' 🐕💢':' 🐕'):'');
  document.getElementById('days-counter').textContent ='Days Survived: '+G.days;
  document.getElementById('season-badge').textContent =['SPRING','SUMMER','AUTUMN','WINTER'][G.season]
    + ' ' + weatherDef().icon
    + (forecastVisible()&&G.forecast&&WEATHERS[G.forecast] ? ' \u2192 '+WEATHERS[G.forecast].icon : '');
  document.getElementById('day-progress').style.width =(G.timeOfDay*100)+'%';
  var labels=['Dawn','Morning','Midday','Afternoon','Dusk','Night'];
  document.getElementById('time-label').textContent=labels[Math.floor(G.timeOfDay*labels.length)%labels.length];
  RECIPES.forEach(function(r){
    var el=document.getElementById('craft-'+r.id);
    if(el) el.className='craft-item'+(canCraft(r)?'':' cant-afford');
  });
  var nf=Math.max(0,Math.sin(G.timeOfDay*Math.PI*2-Math.PI*1.2));
  document.getElementById('night-overlay').style.background='rgba(5,10,20,'+(nf*.55)+')';
  document.querySelector('#morale-pill .icon').textContent=G.morale>70?'😐':G.morale>40?'😔':'😞';
  // HV-9: the neighborhood's read on you
  var rt=REP_TIERS[repTier()];
  var ri=document.getElementById('rep-icon'), rn=document.getElementById('rep-name');
  if(ri) ri.textContent=rt.icon;
  if(rn) rn.textContent=rt.name+' · '+Math.floor(G.rep||0);
}

var logFeed=document.getElementById('log-feed');
var logLines=[];
var eventTimer=null;
function log(msg){
  var d=document.createElement('div');
  d.className='log-line'; d.textContent='> '+msg;
  logFeed.appendChild(d); logLines.push(d);
  if(logLines.length>6){ logLines[0].remove(); logLines.shift(); }
  setTimeout(function(){ d.classList.add('fading'); },6000);
}

var tip=document.getElementById('tooltip');
function showTip(e){
  // No hover on touch devices — a tap fires synthetic mouseenter and the
  // tooltip would stick with no mouseleave to clear it. The cost/label text
  // is already visible on the item, so just skip it.
  if(window.matchMedia('(hover:none)').matches) return;
  var t=e.currentTarget.getAttribute('data-tip'); if(!t) return;
  tip.textContent=t; tip.style.display='block';
  // Keyboard focus events have no pointer coordinates — anchor the
  // tooltip to the focused element instead of the (absent) cursor.
  if(typeof e.clientX==='number') moveTip(e);
  else{
    var r=e.currentTarget.getBoundingClientRect();
    tip.style.left=(r.left)+'px'; tip.style.top=(r.top-8)+'px';
  }
}
function moveTip(e){ tip.style.left=(e.clientX+14)+'px'; tip.style.top=(e.clientY-8)+'px'; }
function hideTip(){ tip.style.display='none'; }
document.addEventListener('mousemove',function(e){ if(tip.style.display==='block') moveTip(e); });

function showEvent(ev, isGood){
  var banner=document.getElementById('event-banner');
  document.getElementById('ev-title').textContent=ev.title;
  document.getElementById('ev-body').textContent=ev.desc;
  banner.className=isGood?'good':'bad';
  banner.style.display='block';
  clearTimeout(eventTimer);
  eventTimer=setTimeout(function(){ banner.style.display='none'; },7000);
}
function closeEvent(){ document.getElementById('event-banner').style.display='none'; }
var sweepEtaTimer=null;
function showSweepWarning(show, etaAt){
  var el=document.getElementById('sweep-warning');
  el.style.display=show?'block':'none';
  var eta=document.getElementById('sweep-eta');
  var btn=document.getElementById('pack-up-btn');
  if(sweepEtaTimer){ clearInterval(sweepEtaTimer); sweepEtaTimer=null; }
  if(show){
    if(btn){ btn.disabled=false; btn.textContent='📦 PACK UP CAMP'; }
    if(etaAt && eta){
      var tick=function(){
        var s=Math.max(0, Math.ceil((etaAt-Date.now())/1000));
        eta.textContent='~'+s+'s';
        if(s<=0 && sweepEtaTimer){ clearInterval(sweepEtaTimer); sweepEtaTimer=null; }
      };
      tick(); sweepEtaTimer=setInterval(tick,250);
    } else if(eta){ eta.textContent=''; }
  }
}
// Pack Up Camp (IDEA-HV-4): during a Lookout warning, spend 5 morale on a
// scramble that stashes most of the goods before the sweep lands. Only
// meaningful because HV-2 made every sweep warned when a Lookout exists —
// the warning window is the payoff for hiring one.
function packUpCamp(){
  if(!G.sweepWarned || G.packedUp) return;
  G.packedUp=true;
  G.morale=Math.max(0, G.morale-5);
  log('Everyone scrambles to stash what they can. Camp packed.');
  var b=document.getElementById('pack-up-btn');
  if(b){ b.disabled=true; b.textContent='PACKED ✓'; }
  updateHUD(); saveGame();
}
document.getElementById('pack-up-btn').addEventListener('click', packUpCamp);

// Small "+N" gain feedback that drifts up over the scene.
function floatText(msg){
  var d=document.createElement('div');
  d.className='float-text'; d.textContent=msg;
  d.style.left=(42+Math.random()*16)+'%';
  document.getElementById('hud').appendChild(d);
  setTimeout(function(){ d.remove(); },1600);
}

// Win state (IDEA-HV-3): the arc's ending. Not a reset by default —
// "keep building" turns the run into an acknowledged sandbox.
function showGraduation(){
  if(document.getElementById('hv-graduation')) return;
  sfx('goal');
  var d=document.createElement('div');
  d.id='hv-graduation';
  d.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(6,8,6,.94);color:#d8e0c8;font-family:monospace;text-align:center;padding:24px;';
  d.innerHTML='<div style="font-size:34px">🔑</div>'+
    '<div style="font-size:17px;letter-spacing:2px;color:#8fce6a">KEYS IN HAND</div>'+
    '<div style="max-width:440px;line-height:1.7">Dena came through. Transitional housing — a door that locks, a radiator that clanks. '+
    'It took <b>'+G.days+'</b> days under the bridge, a community of <b>'+G.peakPopulation+'</b> at its peak, '+
    '<b>'+G.totalScavenged+'</b> dumpsters dug through and <b>'+G.totalCrafted+'</b> things built from nothing.'+
    '<br><br>The camp doesn\u2019t disappear because you did it. Someone else moves into your tent tonight.</div>'+
    '<div style="display:flex;gap:10px">'+
    '<button id="hv-grad-new" style="background:#1c2a18;color:#d8e0c8;border:1px solid #4a7030;padding:8px 22px;font-family:inherit;cursor:pointer;border-radius:4px">START A NEW CAMP</button>'+
    '<button id="hv-grad-stay" style="background:#2a2018;color:#d8cbb0;border:1px solid #6a5030;padding:8px 22px;font-family:inherit;cursor:pointer;border-radius:4px">KEEP BUILDING</button>'+
    '</div>';
  document.body.appendChild(d);
  document.getElementById('hv-grad-new').addEventListener('click',function(){
    localStorage.removeItem(SAVE_KEY); location.reload();
  });
  document.getElementById('hv-grad-stay').addEventListener('click',function(){
    G.arcDone=true; saveGame(); d.remove();
    log('You stayed. The keys sit in your pocket; the camp still needs hands.');
  });
}

// Lose state — mirrors the hvFatal overlay in homeless-village.html,
// but for the camp dying rather than the engine failing. The save is
// kept until "Start over" so the hub still reads s.days meanwhile.
var gameOverShown=false;
function showGameOver(){
  if(gameOverShown||document.getElementById('hv-gameover')) return;
  gameOverShown=true;
  saveGame();
  sfx('gameover');
  var d=document.createElement('div');
  d.id='hv-gameover';
  d.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(6,6,8,.94);color:#d8cbb0;font-family:monospace;text-align:center;padding:24px;';
  d.innerHTML='<div style="font-size:34px">🕯️</div>'+
    '<div style="font-size:17px;letter-spacing:2px;color:#e08060">THE CAMP DIDN\'T MAKE IT</div>'+
    '<div style="max-width:420px;line-height:1.6">Your health gave out. You survived <b>'+G.days+'</b> day'+(G.days===1?'':'s')+' under the bridge, with a community of <b>'+G.peakPopulation+'</b> at its peak.</div>'+
    '<button onclick="localStorage.removeItem(SAVE_KEY);location.reload()" style="background:#2a2018;color:#d8cbb0;border:1px solid #6a5030;padding:8px 22px;font-family:inherit;cursor:pointer;border-radius:4px">START OVER</button>';
  document.body.appendChild(d);
}

// HV-55: the Bridge. Always available — a chain you cannot see is the
// thing this exists to fix, so it is never gated on progress.
function renderChain(){
  var listEl = document.getElementById('chain-list');
  var progEl = document.getElementById('chain-progress');
  if(!listEl) return;
  var st = chainState();
  if(progEl) progEl.textContent = st.doneCount + ' of ' + st.total + ' begun';
  var byId = {}; st.rows.forEach(function(r){ byId[r.id] = r; });
  listEl.innerHTML = st.rows.map(function(r, i){
    var started = r.tally > 0;
    var isNext = i === st.nextIdx;
    // Past the one you're on, rows stay unnamed: the bridge should say
    // it keeps going, not hand over the list.
    var ahead = !r.open && !started && (st.nextIdx === -1 || i > st.nextIdx);
    var label = ahead ? '\u2014' : r.icon + ' ' + r.name;
    var note;
    if(started) note = 'done ' + r.tally + ' time' + (r.tally === 1 ? '' : 's');
    else if(isNext) note = 'yours to do next';
    else if(r.open) note = 'open';
    else if(r.prev.length){
      // Name the predecessor furthest behind: that is the one actually
      // holding this row up.
      var behind = null;
      r.prev.forEach(function(p){
        var b = byId[p];
        if(!b) return;
        if(!behind || b.tally < behind.tally) behind = b;
      });
      note = behind ? behind.tally + ' / ' + r.need + ' toward it' : 'not yet';
    }
    else note = 'not yet';
    var cls = started ? 'chain-done' : isNext ? 'chain-next' : r.open ? 'chain-open' : 'chain-locked';
    return '<div class="chain-row ' + cls + '"><span class="chain-name">' + label
      + '</span><span class="chain-note">' + note + '</span></div>';
  }).join('');
}
function openChain(){
  renderChain();
  var m = document.getElementById('chain-modal');
  if(m) m.classList.add('open');
}
(function(){
  var b = document.getElementById('chain-btn');
  if(b) b.onclick = openChain;
  var c = document.getElementById('chain-close');
  if(c) c.onclick = function(){ document.getElementById('chain-modal').classList.remove('open'); };
  var m = document.getElementById('chain-modal');
  if(m) m.addEventListener('click', function(e){
    if(e.target === m) m.classList.remove('open');
  });
})();

// HV-56: the opening.
//
// Five of the six flagships greet a new player with a crash course. This
// one dropped them beside 47 live controls, a goal that said "Survive 3
// days", and not one word about how. The two things a newcomer reliably
// bounces off are both invisible from the screen:
//   - Scavenge is proximity-gated (HV-2). Standing anywhere else the
//     button just greys out; the explanation lives in a title tooltip,
//     which is nothing at all on a touch screen.
//   - The Workbench gates 13 of the 18 recipes. Miss it and most of the
//     craft panel stays dark for no stated reason.
// Both are stated in the panel. The panel quotes real numbers (5 wood +
// 4 scraps, 13 of 18, warmth below 20%), and quoted numbers rot: the
// tests/headless/hvintro.js suite recomputes each one from RECIPES and
// the dawn code and fails if the copy and the game disagree. Copy that
// lies to a new player is worse than the silence it replaced.
var HVINTRO_KEY = 'hv-intro-seen';
function introSeen(){
  try { return localStorage.getItem(HVINTRO_KEY) === '1'; } catch(e){ return false; }
}
function markIntroSeen(){
  try { localStorage.setItem(HVINTRO_KEY, '1'); } catch(e){}
}
function openIntro(){
  var m = document.getElementById('intro-modal');
  if(m) m.classList.add('open');
}
function closeIntro(){
  var m = document.getElementById('intro-modal');
  if(m) m.classList.remove('open');
  markIntroSeen();
}
(function(){
  var b = document.getElementById('help-btn');
  if(b) b.onclick = openIntro;
  var c = document.getElementById('intro-close');
  if(c) c.onclick = closeIntro;
  var g = document.getElementById('intro-go');
  if(g) g.onclick = closeIntro;
  var m = document.getElementById('intro-modal');
  if(m) m.addEventListener('click', function(e){
    // Click the backdrop to dismiss, same as the Bridge.
    if(e.target === m) closeIntro();
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && m && m.classList.contains('open')) closeIntro();
  });
  // First run only: a returning camp gets straight back to work. The
  // ? button in the top bar reopens it whenever they want it.
  if(!introSeen()) openIntro();
})();
