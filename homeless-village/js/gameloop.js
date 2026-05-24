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

// ── Structures (authoritative version) ──
function refreshStructures(){
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

  G.food  =Math.max(0,G.food  -G.population*1.5);
  G.warmth=Math.max(0,G.warmth-(G.season===3?18:8));
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
  if(G.structures.garden){ var y=rand(1,3); G.food+=y; log('Garden yielded '+y+' food.'); }

  log('Day '+G.days+'. '+['Spring','Summer','Autumn','Winter'][G.season]+'.');
  buildCraftUI(); buildWorkersUI(); updateHUD();
  if(G.days-G.lastEventDay>=2) maybeEvent();
}

function tickDay(dt){
  G.timeOfDay+=G.daySpeed*dt;
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
     G.scraps=Math.max(0,G.scraps-Math.floor(G.scraps*(.3+Math.random()*.4)));
     G.food  =Math.max(0,G.food  -Math.floor(G.food  *(.2+Math.random()*.3)));
     G.morale=Math.max(0,G.morale-rand(15,25));
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
     G.cans  =Math.max(0,G.cans  -Math.floor(G.cans  *(.2+Math.random()*.35)));
     G.food  =Math.max(0,G.food  -Math.floor(G.food  *(.15+Math.random()*.3)));
     G.scraps=Math.max(0,G.scraps-Math.floor(G.scraps*(.1+Math.random()*.2)));
     G.morale=Math.max(0,G.morale-rand(12,20)); log('Stash raided in the night.');
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
     fireLights.forEach(function(fl){ fl.intensity=.1; });
     setTimeout(function(){ fireLights.forEach(function(fl){ fl.intensity=2.0; }); },30000);
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
  if(Math.random()<.18&&!G.sweepWarned){
    if(G.workers.lookout){
      G.sweepWarned=true; showSweepWarning(true);
      log('LOOKOUT: Police activity nearby. Sweep in ~30 seconds!');
      setTimeout(function(){
        if(G.sweepWarned) triggerEvent(EVENTS_BAD.find(function(e){return e.id==='sweep';}),false);
      },30000);
    } else {
      triggerEvent(EVENTS_BAD.find(function(e){return e.id==='sweep';}),false);
    }
    return;
  }
  var bm=G.season===3?1.6:1, pool=[];
  EVENTS_BAD.forEach(function(e){ for(var i=0;i<Math.floor(e.weight*bm);i++) pool.push({ev:e,good:false}); });
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
document.addEventListener('click',initAudio,{once:true});
document.addEventListener('keydown',initAudio,{once:true});
