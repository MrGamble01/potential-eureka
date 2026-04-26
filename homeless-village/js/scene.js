var canvas   = document.getElementById('three-canvas');
var renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x1a1410);

var scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1a1410, 30, 80);

var camSize = 14;
var aspect  = window.innerWidth / window.innerHeight;
var camera  = new THREE.OrthographicCamera(
  -camSize*aspect, camSize*aspect, camSize, -camSize, 0.1, 200
);
camera.position.set(20, 20, 20);
camera.lookAt(0, 0, 0);

var ambient  = new THREE.AmbientLight(0x3a3020, 0.8);
scene.add(ambient);

var sunLight = new THREE.DirectionalLight(0xffe0a0, 1.2);
sunLight.position.set(15, 25, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near   = 1;
sunLight.shadow.camera.far    = 80;
sunLight.shadow.camera.left   = -25;
sunLight.shadow.camera.right  = 25;
sunLight.shadow.camera.top    = 25;
sunLight.shadow.camera.bottom = -25;
scene.add(sunLight);

var fireLights = [];
function addFireLight(x, z){
  var fl = new THREE.PointLight(0xff7020, 2.5, 8);
  fl.position.set(x, 1.2, z);
  scene.add(fl);
  fireLights.push(fl);
  return fl;
}

var MAT = {
  concrete:  new THREE.MeshLambertMaterial({color:0x5a5850}),
  concreteD: new THREE.MeshLambertMaterial({color:0x3a3830}),
  asphalt:   new THREE.MeshLambertMaterial({color:0x2e2c28}),
  rust:      new THREE.MeshLambertMaterial({color:0x7a3820}),
  cardboard: new THREE.MeshLambertMaterial({color:0x9a7a50}),
  wood:      new THREE.MeshLambertMaterial({color:0x6a4820}),
  barrel:    new THREE.MeshLambertMaterial({color:0x3a2a18}),
  fire:      new THREE.MeshLambertMaterial({color:0xff7020, emissive:0xff4000, emissiveIntensity:1.5}),
  metal:     new THREE.MeshLambertMaterial({color:0x5a5858}),
};

function buildGround(){
  var m = new THREE.Mesh(new THREE.PlaneGeometry(50,50), MAT.asphalt);
  m.rotation.x = -Math.PI/2; m.receiveShadow = true;
  scene.add(m);
  for(var i=0;i<12;i++){
    var crack = new THREE.Mesh(new THREE.BoxGeometry(.05,0.02,2+Math.random()*6), MAT.concreteD);
    crack.position.set((Math.random()-.5)*30,.01,(Math.random()-.5)*30);
    crack.rotation.y = Math.random()*Math.PI;
    scene.add(crack);
  }
  for(var j=0;j<30;j++){
    var s=0.08+Math.random()*.15;
    var d=new THREE.Mesh(new THREE.BoxGeometry(s,.04,s*(.5+Math.random())), MAT.cardboard);
    d.position.set((Math.random()-.5)*28,.02,(Math.random()-.5)*28);
    d.rotation.y=Math.random()*Math.PI;
    scene.add(d);
  }
}

function buildBridge(){
  var deck = new THREE.Mesh(new THREE.BoxGeometry(36,1.4,12), MAT.concrete);
  deck.position.set(0,9.5,0); deck.castShadow=true; deck.receiveShadow=true;
  scene.add(deck);

  var under = new THREE.Mesh(new THREE.BoxGeometry(36,.1,12), MAT.concreteD);
  under.position.set(0,8.8,0); scene.add(under);

  var pillarPos=[-14,-6,2,10];
  pillarPos.forEach(function(px){
    [-5,5].forEach(function(pz){
      var p=new THREE.Mesh(new THREE.BoxGeometry(1.2,10,1.2), MAT.concrete);
      p.position.set(px,5,pz); p.castShadow=true; p.receiveShadow=true; scene.add(p);
      var grime=new THREE.Mesh(new THREE.BoxGeometry(1.25,.8,1.25), MAT.concreteD);
      grime.position.set(px,.4,pz); scene.add(grime);
    });
  });

  var rail=new THREE.Mesh(new THREE.BoxGeometry(36,.6,.2), MAT.metal);
  rail.position.set(0,10.5,-5.9); scene.add(rail);
  var rail2=rail.clone(); rail2.position.z=5.9; scene.add(rail2);

  var grafColors=[0x882244,0x224488,0x228844,0x886622];
  pillarPos.forEach(function(px,i){
    var gm=new THREE.MeshLambertMaterial({color:grafColors[i%4],transparent:true,opacity:.4});
    var gp=new THREE.Mesh(new THREE.PlaneGeometry(.6+Math.random()*.6,.4+Math.random()*.6),gm);
    gp.position.set(px+.62,2+Math.random()*2,-4.9); gp.rotation.y=Math.PI/2; scene.add(gp);
  });
}

function buildBarrelFire(x, z){
  var barrel=new THREE.Mesh(new THREE.CylinderGeometry(.35,.4,.7,8), MAT.barrel);
  barrel.position.set(x,.35,z); barrel.castShadow=true; scene.add(barrel);
  var embers=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.1,8), MAT.fire);
  embers.position.set(x,.72,z); scene.add(embers);
  addFireLight(x,z);
}

var dumpsters=[];
function buildDumpster(x, z, rot){
  var body=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.0,.9), MAT.rust);
  body.position.set(x,.5,z); body.rotation.y=rot||0; body.castShadow=true;
  scene.add(body); dumpsters.push(body);
  var lid=new THREE.Mesh(new THREE.BoxGeometry(1.62,.08,.93), MAT.metal);
  lid.position.set(x,1.04,z); lid.rotation.y=rot||0; scene.add(lid);
}

var workbenchMesh=null;
function buildWorkbench(x,z){
  if(workbenchMesh) scene.remove(workbenchMesh);
  var grp=new THREE.Group();
  var top=new THREE.Mesh(new THREE.BoxGeometry(1.8,.12,.9), MAT.wood);
  top.position.y=.82; grp.add(top);
  [-.75,.75].forEach(function(lx){
    [-.35,.35].forEach(function(lz){
      var leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.8,.1), MAT.wood);
      leg.position.set(lx,.4,lz); grp.add(leg);
    });
  });
  grp.position.set(x,0,z); scene.add(grp); workbenchMesh=grp;
}

var tentMesh=null;
function buildTent(x,z){
  if(tentMesh) scene.remove(tentMesh);
  var grp=new THREE.Group();
  var shape=new THREE.Shape();
  shape.moveTo(-1.2,0); shape.lineTo(0,1.6); shape.lineTo(1.2,0); shape.closePath();
  var geo=new THREE.ExtrudeGeometry(shape,{depth:2.2,bevelEnabled:false});
  var mat=new THREE.MeshLambertMaterial({color:0x2a4030,side:THREE.DoubleSide,transparent:true,opacity:.9});
  var tb=new THREE.Mesh(geo,mat);
  tb.rotation.y=Math.PI/2; tb.position.set(1.1,0,-1.2); grp.add(tb);
  grp.position.set(x,0,z); scene.add(grp); tentMesh=grp;
}

var soupKitchenMesh=null;
function buildSoupKitchen(x,z){
  if(soupKitchenMesh) scene.remove(soupKitchenMesh);
  var grp=new THREE.Group();
  grp.add(new THREE.Mesh(new THREE.BoxGeometry(3,.1,2), MAT.wood));
  var cnt=new THREE.Mesh(new THREE.BoxGeometry(2.8,.9,.5), MAT.cardboard);
  cnt.position.set(0,.5,-.7); grp.add(cnt);
  var aw=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.8),
    new THREE.MeshLambertMaterial({color:0x7a4820,side:THREE.DoubleSide,transparent:true,opacity:.85}));
  aw.rotation.x=-.3; aw.position.set(0,2,.2); grp.add(aw);
  grp.position.set(x,0,z); scene.add(grp); soupKitchenMesh=grp;
}

function buildTrashPile(x,z){
  var colors=[0x9a7a50,0x5a3818,0x6a6040,0x3a4a28];
  for(var i=0;i<4+Math.floor(Math.random()*5);i++){
    var s=.15+Math.random()*.25;
    var m=new THREE.Mesh(new THREE.BoxGeometry(s,s*(.3+Math.random()*.4),s*(.5+Math.random())),
      new THREE.MeshLambertMaterial({color:colors[Math.floor(Math.random()*4)]}));
    m.position.set(x+(Math.random()-.5)*.8,s*.2,z+(Math.random()-.5)*.8);
    m.rotation.y=Math.random()*Math.PI; scene.add(m);
  }
}

var figures=[];
function spawnFigure(x,z,type){
  var grp=new THREE.Group();
  var bodyMat=new THREE.MeshLambertMaterial({color:type==='player'?0x5a4030:0x3a4040});
  var body=new THREE.Mesh(new THREE.BoxGeometry(.35,.6,.25),bodyMat);
  body.position.y=.7; grp.add(body);
  var head=new THREE.Mesh(new THREE.BoxGeometry(.3,.3,.3),new THREE.MeshLambertMaterial({color:0x8a6a50}));
  head.position.y=1.2; grp.add(head);
  var beanie=new THREE.Mesh(new THREE.CylinderGeometry(.16,.18,.18,8),
    new THREE.MeshLambertMaterial({color:type==='player'?0x3a2840:0x2a3a30}));
  beanie.position.y=1.4; grp.add(beanie);
  [-1,1].forEach(function(side){
    var arm=new THREE.Mesh(new THREE.BoxGeometry(.12,.45,.12),bodyMat);
    arm.position.set(side*.25,.72,0); grp.add(arm);
  });
  grp.position.set(x,0,z);
  grp.userData={type:type,speed:.02+Math.random()*.015,
    target:new THREE.Vector3(x,0,z),wanderTimer:0,bobPhase:Math.random()*Math.PI*2};
  scene.add(grp); figures.push(grp);
  return grp;
}

// Build world
buildGround();
buildBridge();
buildBarrelFire(-3,0);
buildBarrelFire(2,-3);
buildDumpster(6,4,.2);
buildDumpster(-8,5,-.3);
buildDumpster(8,-5,.4);
buildTrashPile(-5,-4);
buildTrashPile(4,6);
buildTrashPile(-10,2);

var player=spawnFigure(0,0,'player');

function onResize(){
  var w=window.innerWidth,h=window.innerHeight;
  renderer.setSize(w,h);
  var a=w/h;
  camera.left=-camSize*a; camera.right=camSize*a;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize',onResize);
onResize();
