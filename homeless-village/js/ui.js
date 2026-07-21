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
  document.getElementById('pop-val').textContent      =G.population;
  document.getElementById('days-counter').textContent ='Days Survived: '+G.days;
  document.getElementById('season-badge').textContent =['SPRING','SUMMER','AUTUMN','WINTER'][G.season];
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
function showSweepWarning(show){ document.getElementById('sweep-warning').style.display=show?'block':'none'; }

// Small "+N" gain feedback that drifts up over the scene.
function floatText(msg){
  var d=document.createElement('div');
  d.className='float-text'; d.textContent=msg;
  d.style.left=(42+Math.random()*16)+'%';
  document.getElementById('hud').appendChild(d);
  setTimeout(function(){ d.remove(); },1600);
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
