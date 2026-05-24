function buildActionUI(){
  var el=document.getElementById('action-list');
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
  el.innerHTML='';
  RECIPES.forEach(function(r){
    var div=document.createElement('div');
    div.className='craft-item'+(canCraft(r)?'':' cant-afford');
    div.id='craft-'+r.id;
    var costStr=Object.entries(r.cost).map(function(e){return e[1]+e[0];}).join(' ');
    div.innerHTML='<span class="ci-icon">'+r.icon+'</span><div class="ci-info"><span class="ci-name">'+r.name+'</span><span class="ci-cost">'+costStr+'</span></div>';
    div.setAttribute('data-tip',r.desc);
    div.onclick=function(){ doCraft(r); };
    div.addEventListener('mouseenter',showTip);
    div.addEventListener('mouseleave',hideTip);
    el.appendChild(div);
  });
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
  return Object.entries(r.cost).every(function(e){ return G[e[0]]>=e[1]; });
}

function updateHUD(){
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
function log(msg){
  var d=document.createElement('div');
  d.className='log-line'; d.textContent='> '+msg;
  logFeed.appendChild(d); logLines.push(d);
  if(logLines.length>6){ logLines[0].remove(); logLines.shift(); }
  setTimeout(function(){ d.classList.add('fading'); },6000);
}

var tip=document.getElementById('tooltip');
function showTip(e){
  var t=e.currentTarget.getAttribute('data-tip'); if(!t) return;
  tip.textContent=t; tip.style.display='block'; moveTip(e);
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
  setTimeout(function(){ banner.style.display='none'; },7000);
}
function closeEvent(){ document.getElementById('event-banner').style.display='none'; }
function showSweepWarning(show){ document.getElementById('sweep-warning').style.display=show?'block':'none'; }
