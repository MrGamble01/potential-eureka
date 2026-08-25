function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

// ── Proximity gate (IDEA-HV-2) ──
// Scavenging only works standing at a dumpster: walk (WASD or tap the
// ground) up to one of the three bins. Range is generous — the bins are
// 1.6 units wide and the player capsule has its own radius.
var SCAVENGE_RANGE=3.2;
function nearestDumpsterDist(){
  if(typeof dumpsters==='undefined' || !dumpsters.length || typeof player==='undefined') return 0;
  var best=Infinity;
  for(var i=0;i<dumpsters.length;i++){
    var dx=dumpsters[i].position.x-player.position.x;
    var dz=dumpsters[i].position.z-player.position.z;
    var d=Math.sqrt(dx*dx+dz*dz);
    if(d<best) best=d;
  }
  return best;
}
function scavengeInRange(){ return nearestDumpsterDist()<=SCAVENGE_RANGE; }

// Called every frame from main.js so the button reads as walk-up-able
// rather than mysteriously dead. Only touches the DOM on state changes.
var _scavGateOut=null;
function updateScavengeGate(){
  var out=!scavengeInRange();
  if(out===_scavGateOut) return;
  _scavGateOut=out;
  var btn=document.getElementById('action-scavenge');
  if(!btn) return;
  btn.classList.toggle('out-of-range',out);
  btn.title=out ? 'Too far — walk up to a dumpster first (WASD or tap the ground)'
                : 'Dig through dumpsters for scraps, cans, or food.';
}

function doAction(a){
  var now=Date.now();
  if(activeJobs[a.id]) return;
  if(a.id==='oddjob' && oddJobDone()){ log('Today’s odd job is done — check the board tomorrow.'); return; }
  if(a.id==='mural'){
    if(muralDone()){ log('Today’s panel needs to dry — one session a day is all the wall gets.'); return; }
    if(G.scraps<2){ log('Not enough scraps to mix paint (need 2).'); sfx('error'); return; }
  }
  if(a.id==='meeting' && meetingDone()){ log('The camp met recently — give it a day or two.'); return; }
  if(a.id==='busk' && buskDone()){ log('One set a day — your fingers need the rest.'); return; }
  if(a.id==='deposit' && depositDone()){ log('The center took one load today — the cart rests till dawn.'); return; }
  if(a.id==='newcomer'){
    if(!G.newcomerAsk) return;
    if(G.food<NEWCOMER_COST_FOOD || G.wood<NEWCOMER_COST_WOOD){
      log('🫂 A bed takes '+NEWCOMER_COST_FOOD+' food and '+NEWCOMER_COST_WOOD+' wood — the camp comes up short.'); sfx('error'); return;
    }
  }
  if(a.id==='ticket'){
    if(!G.ticketAsk) return;
    if(G.goodwill<TICKET_COST_GW || G.scraps<TICKET_COST_SCRAPS){
      log('🚌 The fare is short — it takes '+TICKET_COST_GW+'🩶 and '+TICKET_COST_SCRAPS+' scraps.'); sfx('error'); return;
    }
  }
  if(G.cooldowns[a.id] && now<G.cooldowns[a.id]) return;
  if(a.id==='scavenge' && !scavengeInRange()){
    log('Too far from a dumpster — walk up to one first (WASD or tap the ground).');
    sfx('error');
    return;
  }
  var duration=now<G.injuredUntil ? a.time*1.8 : a.time;
  activeJobs[a.id]={startTime:now,duration:duration};
  var btn=document.getElementById('action-'+a.id);
  if(btn){ btn.classList.add('active-job'); btn.disabled=true; }
  setTimeout(function(){ finishAction(a); }, duration);
}

function finishAction(a){
  var now=Date.now();
  delete activeJobs[a.id];
  G.cooldowns[a.id]=now+a.cooldown;
  var btn=document.getElementById('action-'+a.id);
  if(btn){ btn.classList.remove('active-job'); btn.disabled=false; }

  if(a.id==='scavenge'){
    var wm=(G.season===3?.5:1)*weatherDef().scav;
    // HV-7: Old Ray knows which dumpsters are worth the walk — empty
    // hauls happen half as often once he's a friend.
    if(Math.random()<.2*wm*(regularStage('ray')===2?.5:1)){
      log('The dumpster is empty. Nothing today.');
    } else {
      var c=Math.floor(rand(0,3)*wm), s=Math.floor(rand(1,4)*wm), f=Math.random()<.45?Math.floor(rand(1,3)*wm):0;
      G.cans+=c; G.scraps+=s; G.food+=f; G.totalScavenged++;
      var parts=[]; if(c>0)parts.push('+'+c+'🫙'); if(s>0)parts.push('+'+s+'🧱'); if(f>0)parts.push('+'+f+'🍞');
      if(parts.length) floatText(parts.join(' '));
      log('Scavenged: '+c+' cans, '+s+' scraps'+(f>0?', '+f+' food':'')+'.'); }
  } else if(a.id==='forage'){
    var w=rand(1,4),cb=rand(2,6); G.wood+=w; G.cardboard+=cb;
    floatText('+'+w+'🪵 +'+cb+'📦');
    log('Found '+w+' wood and '+cb+' cardboard.');
  } else if(a.id==='panhandle'){
    // HV-6: people stop for the dog — a fed Biscuit at your side makes
    // strangers noticeably more generous.
    var dogBoost=G.dog===2&&!G.dogHungry?1.25:1;
    // HV-9: once the neighborhood knows you, strangers stop less warily
    var repBoost=repTier()>=1?1.15:1;
    // HV-11: people slow down for the finished mural — and stay a moment
    var muralBoost=(G.mural||0)>=MURAL_PANELS?1.1:1;
    // HV-18: nobody lingers outside in a cold snap
    var snapCut=snapActive()?0.75:1;
    // HV-26: a salvaged awning keeps the corner open in the rain ---
    // the weather's pan cut is undone (0.5 x 2), clear-day odds.
    var awningDry=(G.structures.awning&&G.weather==='rain')?AWNING_DRY:1;
    if(Math.random()<.55*weatherDef().pan*awningDry*dogBoost*repBoost*muralBoost*snapCut){ var g=rand(1,4); G.goodwill+=g; floatText('+'+g+'🩶'); log('Someone gave you a few coins. +'+g+' goodwill.');
      if(awningDry>1){ G.awningSaves=(G.awningSaves||0)+1; log('\u26F1\uFE0F Dry under the awning \u2014 the corner stayed open.'); }
      bumpRegular('dee'); addRep(1); }
    else { G.morale=Math.max(0,G.morale-3); log('Ignored again. Morale fades a little.'); }
  } else if(a.id==='rest'){
    var h=rand(5,15); G.health=Math.min(100,G.health+h); G.morale=Math.min(100,G.morale+rand(3,8));
    floatText('+'+h+'❤️');
    log('You rest. Health +'+h+'.');
    bumpRegular('ray');
  } else if(a.id==='trade'){
    if(G.cans>=3){ G.cans-=3; G.food+=2; floatText('+2🍞'); log('Traded 3 cans → 2 food.');
      bumpRegular('marisol'); addRep(1); }
    else log('Not enough cans to trade.');
  } else if(a.id==='rainbet'){
    // HV-28: Dee's standing wager — one bet a day, rain side only.
    if(G.rainBetDay===G.days){ log('\ud83c\udfb2 Dee laughs — one bet a day.'); }
    else if(G.goodwill<RAINBET_STAKE){ log('\ud83c\udfb2 Not enough goodwill to cover the stake.'); }
    else {
      G.goodwill-=RAINBET_STAKE; G.rainBetDay=G.days; G.rainBetOn=true;
      floatText('-'+RAINBET_STAKE+'\ud83e\ude76');
      log('\ud83c\udfb2 Bet placed — '+RAINBET_STAKE+' goodwill says rain by morning.');
      bumpRegular('dee');
    }
  } else if(a.id==='garage'){
    // HV-29: sweep insurance through a friend. One cover at a time,
    // spent the night the sweep actually comes.
    if(G.garageCover){ log('\uD83D\uDE99 Everything loose is already in Marisol\u2019s garage.'); }
    else if(G.goodwill<GARAGE_COST){ log('\uD83D\uDE99 Not enough goodwill to ask the favor.'); }
    else {
      G.goodwill-=GARAGE_COST; G.garageCover=true;
      floatText('-'+GARAGE_COST+'\ud83e\ude76');
      log('\uD83D\uDE99 The loose goods spend their nights in Marisol\u2019s garage \u2014 the next sweep takes nothing.');
      bumpRegular('marisol');
    }
  } else if(a.id==='borrow'){
    // HV-30: Ray's front. One standing loan at a time — the ledger
    // remembers even when the mornings are broke.
    if((G.rayDebt||0)>0){ log('\uD83E\uDD1D Ray taps his ledger \u2014 '+G.rayDebt+' still owed. One at a time.'); }
    else {
      G.goodwill=(G.goodwill||0)+BORROW_AMT; G.rayDebt=BORROW_OWED;
      floatText('+'+BORROW_AMT+'\ud83e\ude76');
      log('\uD83E\uDD1D Ray counts '+BORROW_AMT+' goodwill into your hand \u2014 the ledger reads '+BORROW_OWED+', one a morning.');
      bumpRegular('ray');
    }
  } else if(a.id==='fridge'){
    // HV-31: the legacy build. The fridge lives outside the save —
    // built once, for the corner, not the camp.
    var fr=loadFridge();
    if(fr.built){ log('\uD83E\uDDCA The corner fridge already hums \u2014 the block keeps it stocked now.'); }
    else if((G.goodwill||0)<FRIDGE_COST){ log('\uD83E\uDDCA A fridge for the corner takes '+FRIDGE_COST+' goodwill to set right. Not yet.'); }
    else {
      G.goodwill-=FRIDGE_COST;
      saveFridge({built:true, camps:0});
      floatText('-'+FRIDGE_COST+'\ud83e\ude76');
      log('\uD83E\uDDCA The corner fridge hums to life \u2014 anyone can give, anyone can take. It isn\u2019t the camp\u2019s. It\u2019s the corner\u2019s, and it outlives every camp.');
      addRep(5);
      saveGame();
    }
  } else if(a.id==='wall'){
    // HV-34: the bridge's memory, chalked where everyone can see it.
    if(!bridgeHasWall()){ log('\ud83e\uddf1 The wall is bare \u2014 this bridge has no story yet.'); }
    else {
      var ww=loadHvWall();
      saveHvWall({opens:(ww.opens||0)+1});
      log('\ud83e\uddf1 THE WRITING ON THE WALL \u2014 read out to whoever\u2019s around:');
      composeHvWall().forEach(function(s){ log('\ud83e\uddf1 '+s); });
      saveGame();
    }
  } else if(a.id==='thermos'){
    // HV-35: the heirloom pays out of the bridge's memory, once a session.
    if(!thermosHasWarmth()){ log('\ud83e\uded6 The thermos is cold \u2014 this bridge has no story to warm it yet.'); }
    else if(thermosUsed){ log('\ud83e\uded6 The thermos made its round already \u2014 it refills tomorrow.'); }
    else {
      thermosUsed=true;
      var tp=thermosPower();
      var tt=loadThermos();
      saveThermos({uses:(tt.uses||0)+1});
      G.morale=Math.min(100,(G.morale||0)+tp);
      log('\ud83e\uded6 The old thermos goes around the fire \u2014 +'+tp+'\ud83d\ude0a, carried by everything the bridge remembers.');
      floatText('+'+tp+'\ud83d\ude0a');
      saveGame();
    }
  } else if(a.id==='oddjob'){
    // HV-8: today's bulletin-board posting pays out and closes for the day
    var j=todaysJob(), parts=[];
    for(var k in j.gives){
      if(k==='morale') G.morale=Math.min(100,G.morale+j.gives[k]);
      else G[k]=(G[k]||0)+j.gives[k];
      parts.push('+'+j.gives[k]+({goodwill:'🩶',food:'🍞',scraps:'🧱',cans:'🫙',morale:'😊'}[k]||k));
    }
    G.oddJobDay=G.days;
    if(G.structures.toolbox){ G.goodwill=(G.goodwill||0)+TOOLBOX_JOB_BONUS; parts.push('+'+TOOLBOX_JOB_BONUS+'🩶'); }   // HV-24: the right tools
    addRep(3);   // HV-9: honest work is how the neighborhood learns your name
    floatText(parts.join(' '));
    log('Odd job done: '+j.label.toLowerCase()+'. '+parts.join(' ')+'.');
    saveGame();
    buildActionUI();
  } else if(a.id==='mural'){
    // HV-11: one painting session. doAction gates cost and cadence, but
    // re-check here so a queued double-fire can't paint two panels a day.
    if(!muralDone() && G.scraps>=2 && (G.mural||0)<MURAL_PANELS){
      G.scraps-=2; G.mural=(G.mural||0)+1; G.muralDay=G.days;
      G.morale=Math.min(100,G.morale+3);
      addRep(2);
      floatText('🎨 +3😊');
      log('🎨 '+MURAL_LINES[G.mural-1]);
      var painters=REGULARS.filter(function(r){ return regularStage(r.id)===2; });
      if(painters.length) log(painters[0].icon+' '+painters[0].name+' came by to paint a while.');
      if(G.mural>=MURAL_PANELS){
        G.goodwill+=5;
        addRep(5);
        log('🎨 The mural is finished. People slow down to look now. +5 goodwill.');
      }
      refreshStructures();
      saveGame();
      buildActionUI();
    }
  } else if(a.id==='meeting'){
    // HV-14: re-check so a queued double-fire can't hold two circles.
    if(!meetingDone() && (G.population||1)>=2){
      var heads=G.population;
      var gain=Math.min(10, 2*heads);
      G.morale=Math.min(100, G.morale+gain);
      // everyone but you tosses something in the pot
      var pot={}, potKeys=['food','cans','scraps','wood','cardboard'];
      for(var mi=1; mi<heads; mi++){
        var rk=potKeys[rand(0,potKeys.length-1)];
        G[rk]=(G[rk]||0)+1; pot[rk]=(pot[rk]||0)+1;
      }
      G.meetings=(G.meetings||0)+1; G.meetingDay=G.days;
      addRep(2);
      var potParts=Object.keys(pot).map(function(k){ return '+'+pot[k]+({food:'🍞',cans:'🫙',scraps:'🧱',wood:'🪵',cardboard:'📦'}[k]); });
      floatText('🗣️ +'+gain+'😊'+(potParts.length?' '+potParts.join(' '):''));
      log('🗣️ The camp circles the fire — every voice counts. +'+gain+' morale'+(potParts.length?', the pot takes '+potParts.join(' '):'')+'.');
      if(heads>=5){ G.goodwill+=2; log('🩶 Five voices speak as one village. +2 goodwill.'); }
      saveGame();
      buildActionUI();
    }
  } else if(a.id==='deposit'){
    // HV-20: re-check — a queued double-fire must not haul twice.
    if(depositAvailable() && !depositDone()){
      var hauled=G.cans||0;
      var gw=Math.floor(hauled/2), rp=Math.floor(hauled/10);
      G.cans=0;
      G.goodwill+=gw;
      if(rp>0) addRep(rp);
      G.deposits=(G.deposits||0)+1; G.depositDay=G.days;
      floatText('🛒 +'+gw+'🩶'+(rp>0?' +'+rp+'⭐':''));
      log('🛒 Hauled '+hauled+' cans to the redemption center. +'+gw+' goodwill'+(rp>0?', +'+rp+' rep — the block notices industry':'')+'.');
      saveGame();
      buildActionUI();
    }
  } else if(a.id==='busk'){
    // HV-19: re-check — a queued double-fire must not play two sets.
    if(buskAvailable() && !buskDone()){
      var take=buskPay();
      G.goodwill+=take;
      G.morale=Math.min(100,G.morale+2);
      addRep(1);
      G.busks=(G.busks||0)+1; G.buskDay=G.days;
      floatText('🎸 +'+take+'🩶 +2😊');
      log('🎸 Played a set on the corner — '+(G.weather==='heat'?'the scorcher crowd was generous':'a few folks stopped to listen')+'. +'+take+' goodwill, +1 rep.');
      saveGame();
      buildActionUI();
    }
  } else if(a.id==='newcomer'){
    // HV-21: re-check — the ask can lapse mid-action, and a queued
    // double-fire must not seat two people on one bed.
    if(G.newcomerAsk && G.food>=NEWCOMER_COST_FOOD && G.wood>=NEWCOMER_COST_WOOD && (G.population||1)<NEWCOMER_POP_MAX){
      G.food-=NEWCOMER_COST_FOOD; G.wood-=NEWCOMER_COST_WOOD;
      G.newcomerAsk=null;
      G.population+=1;
      G.peakPopulation=Math.max(G.peakPopulation||0,G.population);
      G.welcomes=(G.welcomes||0)+1;
      G.morale=Math.min(100,G.morale+6);
      addRep(2);
      spawnFigure((Math.random()-.5)*10,(Math.random()-.5)*10,'community');
      floatText('🫂 +6😊');
      log('🫂 A bed by the fire and a bowl of something hot — the camp is one bigger tonight. +6 morale, +2 rep.');
      saveGame();
      buildActionUI();
    }
  } else if(a.id==='ticket'){
    // HV-17: re-check — the ask can expire mid-action, and a queued
    // double-fire must not send two people on one fare.
    if(G.ticketAsk && G.goodwill>=TICKET_COST_GW && G.scraps>=TICKET_COST_SCRAPS && G.population>=2){
      G.goodwill-=TICKET_COST_GW; G.scraps-=TICKET_COST_SCRAPS;
      G.ticketAsk=null;
      G.population-=1;
      G.ticketsSent=(G.ticketsSent||0)+1;
      G.morale=Math.min(100,G.morale+8);
      addRep(3);
      // one community figure boards the bus
      for(var fi=figures.length-1; fi>=0; fi--){
        if(figures[fi].userData && figures[fi].userData.type==='community'){
          scene.remove(figures[fi]); figures.splice(fi,1); break;
        }
      }
      floatText('🚌 +8😊');
      log('🚌 The morning bus pulls away with one less resident and one more person going home. The whole camp waves it out of sight. +8 morale, +3 rep.');
      saveGame();
      buildActionUI();
    }
  }
  sfx('action');
  updateHUD();
}

function doCraft(r){
  // Mutex, like doAction's activeJobs: any craft completion rebuilds
  // the whole panel (fresh clickable nodes), so without this a second
  // click on a still-running recipe deducted its cost twice.
  if(G.activeCrafts[r.id]) return;
  if(!canCraft(r)) return;
  var dur=r.time*(G.workers.builder?.5:1);
  Object.entries(r.cost).forEach(function(e){ G[e[0]]-=e[1]; });
  // Persist the in-flight job in the same write as the cost — closing
  // the tab mid-craft used to destroy the resources with no result.
  G.activeCrafts[r.id]={start:Date.now(),duration:dur};
  saveGame();
  updateHUD();
  markCraftBusy(r.id,true);
  setTimeout(function(){ finishCraft(r); }, dur);
}

function finishCraft(r){
  if(!G.activeCrafts[r.id]) return; // already resolved (fast-forwarded on load)
  delete G.activeCrafts[r.id];
  markCraftBusy(r.id,false);
  if(r.gives.structure){ G.structures[r.gives.structure]=true; refreshStructures(); }
  if(r.gives.warmth)   G.warmth=Math.min(100,G.warmth+r.gives.warmth);
  if(r.gives.goodwill) G.goodwill+=r.gives.goodwill;
  G.totalCrafted++;
  sfx('craft');
  log('Crafted '+r.name+'.');
  saveGame();
  updateHUD(); buildCraftUI();
}

// Crafts that were mid-flight when the page closed: the cost was paid
// at start, so grant elapsed ones now and re-arm timers for the rest.
function resumeCrafts(){
  Object.keys(G.activeCrafts).forEach(function(id){
    var r=RECIPES.find(function(x){ return x.id===id; });
    if(!r){ delete G.activeCrafts[id]; return; }
    var j=G.activeCrafts[id], remaining=(j.start+j.duration)-Date.now();
    if(remaining<=0) finishCraft(r);
    else setTimeout(function(){ finishCraft(r); }, remaining);
  });
}

function hireWorker(id){
  var def=WORKER_DEFS.find(function(w){ return w.id===id; });
  if(!def) return;
  if(G.goodwill<def.cost){ log('Not enough goodwill to recruit '+def.name+'.'); return; }
  G.goodwill-=def.cost; G.workers[id]=true;
  G.population=Math.min(20,G.population+1);
  G.peakPopulation=Math.max(G.peakPopulation,G.population); // was tracked in G but never updated
  spawnFigure((Math.random()-.5)*10,(Math.random()-.5)*10,'community');
  sfx('hire');
  log(def.name+' joined the community.');
  buildWorkersUI(); updateHUD();
}

// HV-15: goodwill spent at the notice board becomes civic
// infrastructure — nothing a sweep can take or a thief can carry off.
function doPetition(id){
  var def=PETITIONS.find(function(p){ return p.id===id; });
  if(!def) return;
  if(!petitionsAvailable()){ log('The city only reads petitions from respected camps (50 rep).'); return; }
  if(G.petitions[id]) return;
  if(G.goodwill<def.cost){ log('Not enough goodwill to back the petition (need '+def.cost+'🩶).'); sfx('error'); return; }
  G.goodwill-=def.cost;
  G.petitions[id]=true;
  if(id==='grant'){ G.food+=8; G.wood+=8; G.scraps+=8; floatText('+8🍞 +8🪵 +8🧱'); }
  addRep(2);
  sfx('craft');
  log('📋 The petition went through: '+def.name.toLowerCase()+'. '+def.desc);
  saveGame();
  buildWorkersUI(); updateHUD();
}

// HV-16: filling a friend's favor — goods across, goodwill back.
function doFavor(){
  if(!G.favor) return;
  var f=FAVORS[G.favor.who], r=regularDef(G.favor.who);
  if(!f) { G.favor=null; return; }
  var can=Object.entries(f.need).every(function(e){ return (G[e[0]]||0)>=e[1]; });
  if(!can){ log('Not enough to spare for '+(r?r.name:'the favor')+' yet.'); sfx('error'); return; }
  Object.entries(f.need).forEach(function(e){ G[e[0]]-=e[1]; });
  Object.entries(f.give).forEach(function(e){ G[e[0]]=(G[e[0]]||0)+e[1]; });
  G.favorsDone=(G.favorsDone||0)+1;
  G.favor=null;
  addRep(2);
  sfx('hire');
  log((r?r.icon+' ':'')+(r?r.name:'A friend')+' won\u2019t forget this. +'+Object.values(f.give)[0]+'\ud83e\ude76');
  floatText('+'+Object.values(f.give)[0]+'\ud83e\ude76');
  saveGame();
  buildWorkersUI(); updateHUD();
}
