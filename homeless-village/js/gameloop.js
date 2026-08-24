// ── Garden ──
var gardenMesh=null;
function buildGarden(x,z){
  if(gardenMesh){ scene.remove(gardenMesh); gardenMesh=null; }
  var grp=new THREE.Group();
  var bed=new THREE.Mesh(new THREE.BoxGeometry(3,.2,2),new THREE.MeshLambertMaterial({color:0x4a3820}));
  bed.position.y=.1; grp.add(bed);
  for(var i=0;i<6;i++){
    var h=.3+Math.random()*.5;
    var stem=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,h,4),new THREE.MeshLambertMaterial({color:0x3a6020}));
    stem.position.set((Math.random()-.5)*2.4,.2+h/2,(Math.random()-.5)*1.6);
    grp.add(stem);
  }
  grp.position.set(x,0,z); scene.add(grp); gardenMesh=grp;
}

// ── The stray dog (HV-6) ──
var dogMesh=null;
function buildDog(){
  var grp=new THREE.Group();
  var fur=new THREE.MeshLambertMaterial({color:0x8a6a42});
  var body=new THREE.Mesh(new THREE.BoxGeometry(.7,.35,.3),fur);
  body.position.y=.45; grp.add(body);
  var head=new THREE.Mesh(new THREE.BoxGeometry(.28,.26,.26),fur);
  head.position.set(.42,.62,0); grp.add(head);
  var snout=new THREE.Mesh(new THREE.BoxGeometry(.14,.12,.14),new THREE.MeshLambertMaterial({color:0x6a4e2e}));
  snout.position.set(.58,.56,0); grp.add(snout);
  var tail=new THREE.Mesh(new THREE.BoxGeometry(.22,.06,.06),fur);
  tail.position.set(-.42,.58,0); tail.rotation.z=.5; grp.add(tail);
  for(var i=0;i<4;i++){
    var leg=new THREE.Mesh(new THREE.BoxGeometry(.07,.3,.07),fur);
    leg.position.set(i<2?.24:-.24,.15,i%2?.1:-.1); grp.add(leg);
  }
  return grp;
}
function refreshDog(){
  if(G.dog>0&&!dogMesh){ dogMesh=buildDog(); scene.add(dogMesh); }
  if(G.dog===0&&dogMesh){ scene.remove(dogMesh); dogMesh=null; }
  // wary: watches from the fence line. Friend: curled up by the barrel fire.
  if(dogMesh){
    if(G.dog===2){ dogMesh.position.set(2.2,0,1.6); dogMesh.rotation.y=-.6; }
    else { dogMesh.position.set(9,0,8); dogMesh.rotation.y=Math.PI*.8; }
  }
}

// ── Structures (authoritative version) ──
function refreshStructures(){
  refreshDog();
  if(G.structures.workbench&&!workbenchMesh)    buildWorkbench(3,2);
  if(!G.structures.workbench&&workbenchMesh){   scene.remove(workbenchMesh); workbenchMesh=null; }
  if(G.structures.tent&&!tentMesh)              buildTent(-4,-2);
  if(!G.structures.tent&&tentMesh){             scene.remove(tentMesh); tentMesh=null; }
  if(G.structures.soup_kitchen&&!soupKitchenMesh) buildSoupKitchen(0,-6);
  if(!G.structures.soup_kitchen&&soupKitchenMesh){ scene.remove(soupKitchenMesh); soupKitchenMesh=null; }
  if(G.structures.garden&&!gardenMesh)          buildGarden(-7,4);
  if(!G.structures.garden&&gardenMesh){         scene.remove(gardenMesh); gardenMesh=null; }
}

// ── Day / New Day ──
function onNewDay(){
  G.days++; saveGame();
  G.season=Math.floor(G.days/7)%4;
  // yesterday's forecast becomes today's sky; tomorrow gets its own roll
  G.weather=G.forecast||rollWeather();
  G.forecast=rollWeather();

  G.food  =Math.max(0,G.food  -G.population*1.5);
  G.warmth=Math.max(0,Math.min(100,G.warmth-(G.season===3?18:8)-weatherDef().warmth));
  G.morale=Math.max(0,G.morale-3);
  if(G.warmth<20) G.health=Math.max(0,G.health-rand(5,12));
  if(G.food<=0)   G.health=Math.max(0,G.health-rand(4,10));

  if(G.structures.tent&&Math.random()<(G.season===3?.15:.05)){
    G.structures.tent=false; refreshStructures(); log('Your tent tore in the wind.');
  }
  if(G.structures.workbench&&Math.random()<.04){
    G.structures.workbench=false; refreshStructures(); log('The workbench fell apart.');
  }
  if(G.workers.scrapper){ G.scraps+=rand(1,3); G.cans+=rand(0,2); log('The Scrapper found some supplies.'); }
  if(G.workers.cook&&G.food>=3){ G.food-=3; G.goodwill+=2; log('The Cook prepared meals. +2 goodwill.'); }
  if(G.structures.garden){
    if(G.weather==='cold'){ log('Frost on the beds — the garden gave nothing today.'); }
    else { var y=rand(1,3); G.food+=y; floatText('+'+y+'🍞'); log('Garden yielded '+y+' food.'); }
  }
  if(G.dog===2){
    // Biscuit's keep: one food a day. Fed, he's warmth against your back
    // and a reason to get up; hungry, he's a guilt that wears on everyone.
    if(G.food>=1){
      G.food-=1; G.dogHungry=false;
      G.morale=Math.min(100,G.morale+2); G.warmth=Math.min(100,G.warmth+3);
    } else {
      G.dogHungry=true; G.morale=Math.max(0,G.morale-2);
      log('No scraps left for Biscuit. He curls up hungry.');
    }
  }
  regularFavorsAtDawn();
  repAtDawn();
  soupNightAtDawn();

  log('Day '+G.days+'. '+['Spring','Summer','Autumn','Winter'][G.season]+'. '+weatherDef().icon+' '+weatherDef().name+'.');
  if(G.weather==='cold') log('\u2744\ufe0f The cold gets into everything — keep the fire fed.');
  if(G.weather==='heat') log('\ud83e\udd75 A scorcher. Foot traffic is up — a good day to panhandle.');
  if(forecastVisible()&&G.forecast&&WEATHERS[G.forecast]) log('\ud83d\udcfb Tomorrow: '+WEATHERS[G.forecast].icon+' '+WEATHERS[G.forecast].name+'.');
  buildCraftUI(); buildWorkersUI(); buildActionUI(); updateHUD();
  if(G.days-G.lastEventDay>=2) maybeEvent();
  checkArc();
  checkDog();
  checkGameOver(); // after maybeEvent so same-day event damage counts
}

// ── The regulars (HV-7) ──
// Affinity bumps arrive from finishAction (trade → Marisol, rest → Ray,
// panhandle success → Dee). Knowing someone (1+) puts a name to a face;
// friendship (5+) unlocks their standing favor, applied here and in
// scavenge's empty-roll.
function bumpRegular(id){
  if(!G.regulars) G.regulars={marisol:0,ray:0,dee:0};
  var before=regularStage(id);
  G.regulars[id]=Math.min(10,(G.regulars[id]||0)+1);
  var after=regularStage(id), d=regularDef(id);
  if(d&&after!==before){
    if(after===1) log(d.icon+' You learn the name of the one who '+d.who+': '+d.name+'.');
    else { log(d.icon+' '+d.name+' counts you as a friend now — '+d.name.split(' ')[0]+' '+d.perk+'.');
      addRep(5); }   // HV-9: a friend who vouches for you carries real weight
  }
  buildRegularsUI();
}
function regularFavorsAtDawn(){
  // Marisol: some mornings there's a bag of leftovers on the fence post.
  if(regularStage('marisol')===2&&Math.random()<.3){
    var f=rand(2,4); G.food+=f;
    log('🌮 Marisol left a bag of tamales on the fence post. +'+f+' food.');
  }
  // Dee: finds you in bad shape on her way home, once every few days.
  if(regularStage('dee')===2&&G.health<30&&G.days-(G.lastDeeDay||-9)>=3){
    G.health=Math.min(100,G.health+10);
    G.lastDeeDay=G.days;
    log('🩺 Dee spotted you looking rough and patched you up. +10 health.');
  }
}

// ── HV-10: Soup Night — the Soup Kitchen finally does its promised job.
// If the pot could feed everyone last night (1 food per resident), the
// camp wakes fed: morale and health up, and sometimes a neighbor who
// smelled the cooking leaves a little goodwill on the counter. A short
// pantry just means the pot stayed cold — no punishment for being broke.
function soupNightAtDawn(){
  if(!G.structures.soup_kitchen||G.population<1) return;
  if(G.food<G.population){ log('🍲 The pot stayed cold last night — not enough food to serve everyone.'); return; }
  G.food-=G.population;
  G.morale=Math.min(100,G.morale+4);
  G.health=Math.min(100,G.health+2);
  G.soupNights=(G.soupNights||0)+1;
  var extra='';
  if(Math.random()<.25){ var gg=rand(1,2); G.goodwill+=gg; addRep(1); extra=' A neighbor smelled the cooking and left +'+gg+' goodwill.'; }
  log('🍲 Soup night — everyone ate hot. +4 morale, +2 health.'+extra);
}

// ── HV-9: reputation at dawn — word fades, and Beloved camps wake to
// the occasional gift on the fence post (once a day at most).
function repAtDawn(){
  if(G.days>1&&(G.rep||0)>0) addRep(-1);
  if(repTier()>=3&&G.repGiftDay!==G.days&&Math.random()<.2){
    G.repGiftDay=G.days;
    if(Math.random()<.5){ var gf=rand(1,3); G.food+=gf; log('💛 A neighbor left a covered plate on the fence post. +'+gf+' food.'); }
    else { var gg=rand(2,4); G.goodwill+=gg; log('💛 An envelope on the fence post — a neighbor saying thanks. +'+gg+' goodwill.'); }
  }
}

// ── The stray dog arc (HV-6) ──
// Staged deterministically like the Case Worker: a thin dog appears at
// the fence on day 4, and two days later — if the camp can spare food —
// he decides you're worth trusting. From then on he eats one food a day,
// buys morale and night warmth, makes panhandling land more often, chases
// off thieves, and barks a 15-second warning before unwatched sweeps.
var DOG_EVENTS={
  stray:{id:'dog_stray',title:'A Stray Dog',type:'good',
    desc:'A thin dog with one torn ear watches the camp from the fence line. He keeps his distance, but he doesn’t leave. Someone starts calling him Biscuit.',
    effect:function(){ G.lastEventDay=G.days; G.morale=Math.min(100,G.morale+4);
      log('A stray dog is hanging around the fence. Keep some food on hand and he may come closer.'); }},
  joins:{id:'dog_joins',title:'Biscuit Comes Closer',type:'good',
    desc:'The dog walks into camp like he’s always lived here, eats what’s offered, and falls asleep against the barrel fire. That’s that, then.',
    effect:function(){ G.lastEventDay=G.days; G.food=Math.max(0,G.food-2);
      G.morale=Math.min(100,G.morale+10); refreshDog();
      log('Biscuit joined the camp. One food a day keeps him fed — he earns it.'); }},
};
function checkDog(){
  if(G.dog===0&&G.days>=4){
    G.dog=1; G.dogMetDay=G.days; refreshDog(); triggerEvent(DOG_EVENTS.stray,true); saveGame();
  } else if(G.dog===1&&G.days>=G.dogMetDay+2&&G.food>=3){
    G.dog=2; triggerEvent(DOG_EVENTS.joins,true); saveGame();
  }
}

// ── The Case Worker arc (IDEA-HV-3) ──
// The one storyline with an exit. Three staged milestones checked each
// new day — not random-pool events, so the chain can't be missed — and
// the finale is an actual ending: keys to transitional housing, with a
// sandbox continue for players who want to keep building the camp.
var ARC_EVENTS={
  card:{id:'arc_card',title:'The Case Worker',type:'good',
    desc:'A county case worker named Dena stops by. She looks around — people fed, fire going, something like order. "This isn\u2019t nothing," she says, and leaves her card.',
    effect:function(){ G.lastEventDay=G.days; G.morale=Math.min(100,G.morale+8);
      log('Dena the case worker left her card. Keep the camp strong — build the Soup Kitchen, grow to 4 people.'); }},
  paperwork:{id:'arc_paperwork',title:'Paperwork, Hope',type:'good',
    desc:'Dena is back with forms. A transitional-housing pilot wants people who can hold a community together. "Keep morale up and put some goodwill aside — I\u2019ll file it."',
    effect:function(){ G.lastEventDay=G.days; G.morale=Math.min(100,G.morale+10);
      log('Housing paperwork started. Dena needs: 25 goodwill saved and morale above 60.'); }},
};
function checkArc(){
  if(G.arcDone) return;
  if(G.arcStage===0 && G.days>=10 && G.goodwill>=15){
    G.arcStage=1; triggerEvent(ARC_EVENTS.card,true); saveGame();
  } else if(G.arcStage===1 && G.structures.soup_kitchen && G.population>=4){
    G.arcStage=2; triggerEvent(ARC_EVENTS.paperwork,true); saveGame();
  } else if(G.arcStage===2 && G.goodwill>=25 && G.morale>60){
    G.arcStage=3; saveGame();
    showGraduation();
  }
}

// The warmth/food drain and events above clamp health at 0 but nothing
// ever acted on it — the game literally could not be lost.
function checkGameOver(){
  if(G.health<=0) showGameOver();
}

function tickDay(dt){
  if(gameOverShown) return; // time stops behind the game-over overlay
  G.timeOfDay+=dt/DAY_LENGTH_MS;
  if(G.timeOfDay>=1){ G.timeOfDay-=1; onNewDay(); }

  var tod=G.timeOfDay;
  if(tod<.5){
    var t=tod*2;
    sunLight.intensity=t*1.3; ambient.intensity=.2+t*.7;
    sunLight.color.setRGB(1,.6+t*.4,(.6+t*.4)*.8);
  } else {
    var t2=(tod-.5)*2;
    sunLight.intensity=Math.max(0,1.3-t2*1.2); ambient.intensity=Math.max(.15,.9-t2*.75);
    sunLight.color.setRGB(1,Math.max(.1,.8-t2*.5),Math.max(0,.5-t2*.45));
  }
  updateHUD();
}

// ── Events ──
var EVENTS_BAD=[
  {id:'sweep',title:'City Sweep',type:'bad',weight:18,
   desc:'Police are clearing the camp. They destroy shelters and confiscate supplies.',
   effect:function(){
     G.timesSwept++; G.lastEventDay=G.days;
     if(G.structures.tent){ G.structures.tent=false; log('Your tent was demolished.'); }
     if(G.structures.soup_kitchen&&Math.random()<.7){ G.structures.soup_kitchen=false; log('Soup kitchen torn down.'); }
     if(G.structures.workbench&&Math.random()<.5){ G.structures.workbench=false; log('Workbench smashed.'); }
     // The Garden's own description ("Gets destroyed in sweeps") promised
     // this outright — it's an exposed, unguarded plot, so unlike the
     // workbench/soup kitchen it isn't a coin-flip.
     if(G.structures.garden){ G.structures.garden=false; log('The garden was trampled and torn up.'); }
     // A packed camp keeps 75% of what the sweep would have taken —
     // the payoff for spending the Lookout's warning window on the
     // scramble instead of ignoring it (IDEA-HV-4).
     var keep=G.packedUp?0.25:1;
     var lostScraps=Math.floor(G.scraps*(.3+Math.random()*.4)*keep);
     var lostFood  =Math.floor(G.food  *(.2+Math.random()*.3)*keep);
     G.scraps=Math.max(0,G.scraps-lostScraps);
     G.food  =Math.max(0,G.food  -lostFood);
     G.morale=Math.max(0,G.morale-rand(15,25));
     if(G.packedUp) log('Packing up paid off — most supplies were saved.');
     G.packedUp=false;
     refreshStructures(); showSweepWarning(false);
   }},
  {id:'cold_snap',title:'Cold Snap',type:'bad',weight:14,
   desc:"Temperature drops hard tonight. Everyone's suffering.",
   effect:function(){
     G.lastEventDay=G.days;
     G.warmth=Math.max(0,G.warmth-rand(20,35));
     G.health=Math.max(0,G.health-rand(8,18));
     G.morale=Math.max(0,G.morale-rand(10,15));
     log('Cold snap hit. Warmth and health dropped.');
   }},
  {id:'theft',title:'Theft',type:'bad',weight:12,
   desc:'Someone raided your stash in the night. Trust no one.',
   effect:function(){
     G.lastEventDay=G.days;
     var dm=G.dog===2?.5:1; // HV-6: Biscuit's barking cuts the losses in half
     G.cans  =Math.max(0,G.cans  -Math.floor(G.cans  *(.2+Math.random()*.35)*dm));
     G.food  =Math.max(0,G.food  -Math.floor(G.food  *(.15+Math.random()*.3)*dm));
     G.scraps=Math.max(0,G.scraps-Math.floor(G.scraps*(.1+Math.random()*.2)*dm));
     G.morale=Math.max(0,G.morale-rand(12,20));
     log(G.dog===2?'Thieves in the night — Biscuit chased them off before they got everything.':'Stash raided in the night.');
   }},
  {id:'injury',title:'Injury',type:'bad',weight:10,
   desc:'You hurt yourself. Moving slowly for the next while.',
   effect:function(){
     G.lastEventDay=G.days;
     G.health=Math.max(0,G.health-rand(15,30));
     G.injuredUntil=Date.now()+90000;
     log('Injured. Actions will be slower for a while.');
   }},
  {id:'gentrify',title:'Gentrification',type:'bad',weight:8,
   desc:'New development nearby. Harassment from locals is increasing.',
   effect:function(){
     G.lastEventDay=G.days;
     G.morale  =Math.max(0,G.morale  -rand(18,28));
     G.goodwill=Math.max(0,G.goodwill-rand(3,8));
     log('More hostility in the area. Morale suffers.');
   }},
  {id:'sickness',title:'Illness Spreading',type:'bad',weight:11,
   desc:'A bug is going through the camp. Everyone feels terrible.',
   effect:function(){
     G.lastEventDay=G.days;
     G.health=Math.max(0,G.health-rand(12,22));
     G.food  =Math.max(0,G.food  -rand(2,5));
     log('Sickness hit the community. Health fell.');
   }},
  {id:'dumpster_locked',title:'Dumpsters Locked',type:'bad',weight:7,
   desc:'Property management put locks on the dumpsters. Nothing to scavenge today.',
   effect:function(){
     G.lastEventDay=G.days;
     G.cooldowns['scavenge']=Date.now()+60000;
     G.cooldowns['forage']  =Date.now()+45000;
     log('Dumpsters locked. Scavenging blocked for a while.');
   }},
  {id:'fire_out',title:'Fire Went Out',type:'bad',weight:9,
   desc:'The barrel fire died overnight. Everything is colder.',
   effect:function(){
     G.lastEventDay=G.days;
     G.warmth=Math.max(0,G.warmth-rand(15,25));
     G.fireOutUntil = Date.now()+30000;
     log("The fire burned out. It's cold and dark.");
   }},
];

var EVENTS_GOOD=[
  {id:'kind_stranger',title:'Kind Stranger',type:'good',weight:10,
   desc:'Someone left a bag of food near the bridge. Small mercy.',
   effect:function(){
     G.lastEventDay=G.days; var f=rand(3,8); G.food+=f;
     G.morale=Math.min(100,G.morale+rand(5,10));
     log('Found donated food. +'+f+' food.');
   }},
  {id:'found_money',title:'Found $5',type:'good',weight:9,
   desc:'A crumpled bill on the sidewalk. Small win.',
   effect:function(){
     G.lastEventDay=G.days; G.goodwill+=rand(3,6);
     G.morale=Math.min(100,G.morale+rand(4,8));
     log('Found a few dollars. +goodwill.');
   }},
  {id:'good_weather',title:'Good Weather',type:'good',weight:11,
   desc:'Clear skies and mild temps. A rare easy day.',
   effect:function(){
     G.lastEventDay=G.days;
     G.warmth=Math.min(100,G.warmth+rand(10,18));
     G.morale=Math.min(100,G.morale+rand(8,14));
     log('Nice weather today. Warmth and morale up.');
   }},
  {id:'old_friend',title:'Old Friend',type:'good',weight:6,
   desc:'Someone from before recognized you. The feeling fades quickly.',
   effect:function(){
     G.lastEventDay=G.days;
     G.morale=Math.min(100,G.morale+rand(12,20));
     setTimeout(function(){
       G.morale=Math.max(0,G.morale-rand(8,14));
       log('The good feeling from yesterday is gone.');
     },120000);
     log('A familiar face. Morale surged — briefly.');
   }},
  {id:'church_donation',title:'Church Donated Supplies',type:'good',weight:8,
   desc:'A volunteer group dropped off some essentials.',
   effect:function(){
     G.lastEventDay=G.days; G.food+=rand(4,9); G.scraps+=rand(2,5);
     G.morale=Math.min(100,G.morale+rand(5,10));
     log('Volunteers dropped supplies. Food and scraps gained.');
   }},
];

function maybeEvent(){
  if(G.days<2||Math.random()>.55) return;
  // HV-9: a Respected camp draws fewer complaint calls — sweeps come
  // a third less often once the neighborhood vouches for you.
  if(Math.random()<.18*(repTier()>=2?.67:1)&&!G.sweepWarned){
    if(G.workers.lookout){
      G.sweepWarned=true; G.packedUp=false;
      showSweepWarning(true, Date.now()+30000);
      log('LOOKOUT: Police activity nearby. Sweep in ~30 seconds!');
      setTimeout(function(){
        if(G.sweepWarned) triggerEvent(EVENTS_BAD.find(function(e){return e.id==='sweep';}),false);
      },30000);
    } else if(G.dog===2){
      // HV-6: no Lookout, but Biscuit hears the trucks — half the warning
      // window a paid Lookout gives, still enough to hit PACK UP.
      G.sweepWarned=true; G.packedUp=false;
      showSweepWarning(true, Date.now()+15000);
      log('Biscuit will not stop barking at the road. Something is coming — ~15 seconds!');
      setTimeout(function(){
        if(G.sweepWarned) triggerEvent(EVENTS_BAD.find(function(e){return e.id==='sweep';}),false);
      },15000);
    } else {
      triggerEvent(EVENTS_BAD.find(function(e){return e.id==='sweep';}),false);
    }
    return;
  }
  var bm=G.season===3?1.6:1, pool=[];
  // Sweeps only ever come through the dedicated branch above (which
  // honors the Lookout's warning). Leaving 'sweep' in this general
  // pool let ~38% of sweeps fire instantly with no warning even when
  // the player had paid for a Lookout.
  EVENTS_BAD.forEach(function(e){ if(e.id==='sweep') return; for(var i=0;i<Math.floor(e.weight*bm);i++) pool.push({ev:e,good:false}); });
  EVENTS_GOOD.forEach(function(e){ for(var i=0;i<e.weight;i++) pool.push({ev:e,good:true}); });
  var pick=pool[Math.floor(Math.random()*pool.length)];
  triggerEvent(pick.ev,pick.good);
}

function triggerEvent(ev,isGood){
  showEvent(ev,!!isGood); ev.effect();
  G.sweepWarned=false; showSweepWarning(false);
  refreshStructures(); updateHUD();
}

// ── Audio ──
var audioCtx=null;
function initAudio(){
  if(audioCtx) return;
  audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  startRumble(); startCrackle(); startTraffic();
}
function startRumble(){
  function tick(){
    if(!audioCtx) return;
    var buf=audioCtx.createBuffer(1,audioCtx.sampleRate*3,audioCtx.sampleRate);
    var d=buf.getChannelData(0); for(var i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*.012;
    var src=audioCtx.createBufferSource(); src.buffer=buf;
    var filt=audioCtx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=80;
    var g=audioCtx.createGain(); g.gain.value=.18;
    src.connect(filt); filt.connect(g); g.connect(audioCtx.destination);
    src.start(); src.onended=tick;
  }
  tick();
}
function startCrackle(){
  function tick(){
    if(!audioCtx) return;
    var t=audioCtx.currentTime+Math.random()*.4;
    var buf=audioCtx.createBuffer(1,Math.floor(audioCtx.sampleRate*.08),audioCtx.sampleRate);
    var d=buf.getChannelData(0); for(var i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*.4;
    var src=audioCtx.createBufferSource(); src.buffer=buf;
    var filt=audioCtx.createBiquadFilter(); filt.type='bandpass'; filt.frequency.value=1200+Math.random()*800;
    var g=audioCtx.createGain(); g.gain.setValueAtTime(.04+Math.random()*.05,t); g.gain.linearRampToValueAtTime(0,t+.1);
    src.connect(filt); filt.connect(g); g.connect(audioCtx.destination);
    src.start(t); setTimeout(tick,120+Math.random()*600);
  }
  tick();
}
function startTraffic(){
  function tick(){
    if(!audioCtx) return;
    var dur=.6+Math.random()*.8, t=audioCtx.currentTime;
    var buf=audioCtx.createBuffer(1,Math.floor(audioCtx.sampleRate*dur),audioCtx.sampleRate);
    var d=buf.getChannelData(0); for(var i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*.3;
    var src=audioCtx.createBufferSource(); src.buffer=buf;
    var filt=audioCtx.createBiquadFilter(); filt.type='bandpass'; filt.frequency.value=400+Math.random()*400;
    var g=audioCtx.createGain();
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.065,t+dur*.3); g.gain.linearRampToValueAtTime(0,t+dur);
    src.connect(filt); filt.connect(g); g.connect(audioCtx.destination);
    src.start(t); setTimeout(tick,4000+Math.random()*12000);
  }
  tick();
}
// Short UI blips layered on top of the ambient loops. Same audioCtx —
// before the first click/keydown initializes it this is a silent no-op.
function sfx(kind){
  if(!audioCtx) return;
  var notes={
    action:  [440,660],
    error:   [220,175],
    craft:   [523,659,784],
    hire:    [392,523,659],
    goal:    [523,659,784,1047],
    gameover:[330,262,196,131],
  }[kind]||[440];
  var spacing=kind==='gameover'?.22:.08, t=audioCtx.currentTime;
  notes.forEach(function(f,i){
    var o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type=kind==='gameover'?'sine':'triangle'; o.frequency.value=f;
    var start=t+i*spacing;
    g.gain.setValueAtTime(0,start);
    g.gain.linearRampToValueAtTime(.09,start+.015);
    g.gain.linearRampToValueAtTime(0,start+spacing+.06);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(start); o.stop(start+spacing+.08);
  });
}

document.addEventListener('click',initAudio,{once:true});
document.addEventListener('keydown',initAudio,{once:true});
