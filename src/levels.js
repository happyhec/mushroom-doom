import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Each course has its own architecture and route. Geometry is batched by material
// while collision stays in the same X/Z space used by the fast FPS controller.
export function createAdditionalLevel(scene, index) {
  const infernal=index===1;
  const colliders=[],shootables=[],batches=new Map(),lavaZones=[],lights=[],rotating=[],steam=[];
  const mapBounds={minX:-23,maxX:23,minZ:-65,maxZ:32};
  let seed=8077+index*17;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  function texture(kind){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const c=canvas.getContext('2d');
    c.fillStyle=kind==='floor'?'#333940':kind==='wall'?'#303b38':kind==='stripe'?'#ae7f24':'#431a13';c.fillRect(0,0,512,512);
    if(kind==='wall'||kind==='floor'){
      const h=kind==='wall'?64:128,w=128;
      for(let row=-1;row<9;row++)for(let col=-1;col<6;col++){
        const x=col*w+(row%2)*64,y=row*h,v=42+Math.floor(rand()*30);
        c.fillStyle=infernal?`rgb(${v},${v+7},${v+2})`:`rgb(${v+5},${v+1},${v+13})`;c.fillRect(x+3,y+3,w-6,h-6);
        c.fillStyle='#ffffff10';c.fillRect(x+4,y+4,w-8,2);c.fillStyle='#0000003b';c.fillRect(x+4,y+h-5,w-8,3);
        for(let j=0;j<60;j++){c.fillStyle=rand()>.5?'#00000018':'#ffffff09';c.fillRect(x+rand()*w,y+rand()*h,rand()*13+1,rand()*3+1);}
        if(rand()>.55){c.strokeStyle='#16171488';c.beginPath();c.moveTo(x+20,y+3);c.lineTo(x+39,y+h*.45);c.lineTo(x+34,y+h-2);c.stroke();}
      }
    }else if(kind==='stripe'){
      c.fillStyle='#151e16';for(let x=-512;x<1024;x+=128){c.beginPath();c.moveTo(x,0);c.lineTo(x+64,0);c.lineTo(x-448,512);c.lineTo(x-512,512);c.fill();}
      for(let i=0;i<1000;i++){c.fillStyle='#00000016';c.fillRect(rand()*512,rand()*512,rand()*10,rand()*4);}
    }else if(kind==='lava'){
      c.fillStyle=infernal?'#d34e0b':'#732967';c.fillRect(0,0,512,512);
      for(let i=0;i<90;i++){c.fillStyle=rand()>.6?(infernal?'#ffba26':'#d75bad'):(infernal?'#48180b':'#261832');c.beginPath();c.ellipse(rand()*512,rand()*512,rand()*56+8,rand()*21+3,rand()*3,0,7);c.fill();}
    }
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;
  }
  const wallTexture=texture('wall'),floorTexture=texture('floor'),lavaTexture=texture('lava');
  const mat={
    stone:new THREE.MeshStandardMaterial({map:wallTexture,bumpMap:wallTexture,bumpScale:.15,color:infernal?'#a7b198':'#a69fb7',roughness:.95}),
    floor:new THREE.MeshStandardMaterial({map:floorTexture,bumpMap:floorTexture,bumpScale:.11,color:infernal?'#9d9b73':'#9a91af',roughness:.9}),
    trim:new THREE.MeshStandardMaterial({color:infernal?'#4c5e45':'#585064',roughness:.7,metalness:.2}),
    dark:new THREE.MeshStandardMaterial({color:infernal?'#17221a':'#191522',roughness:.8}),
    green:new THREE.MeshStandardMaterial({color:'#355c37',roughness:.43,metalness:.72}),
    brass:new THREE.MeshStandardMaterial({color:'#987237',roughness:.38,metalness:.65}),
    iron:new THREE.MeshStandardMaterial({color:infernal?'#3d4942':'#454054',roughness:.46,metalness:.7}),
    red:new THREE.MeshStandardMaterial({color:'#7f2321',roughness:.8}),
    ivory:new THREE.MeshStandardMaterial({color:'#aeb2a0',roughness:.8}),
    stripe:new THREE.MeshStandardMaterial({map:texture('stripe'),roughness:.75}),
    glow:new THREE.MeshBasicMaterial({color:infernal?'#ff9b35':'#bd7ef2'}),
    paleGlow:new THREE.MeshBasicMaterial({color:infernal?'#ffe2a3':'#b2d7ff'}),
    lava:new THREE.MeshBasicMaterial({map:lavaTexture,color:infernal?'#ffb454':'#d376e7'}),
  };
  const temp=new THREE.Object3D();
  function add(geo,material,x,y,z,rx=0,ry=0,rz=0,solid=false){
    temp.position.set(x,y,z);temp.rotation.set(rx,ry,rz);temp.scale.set(1,1,1);temp.updateMatrix();geo.applyMatrix4(temp.matrix);
    const key=material.uuid+(solid?'s':'d');if(!batches.has(key))batches.set(key,{material,solid,geometries:[]});batches.get(key).geometries.push(geo);
  }
  function box(x,y,z,w,h,d,material=mat.stone,solid=false){
    const g=new THREE.BoxGeometry(w,h,d);
    if(material===mat.stone||material===mat.floor){const uv=g.attributes.uv,sizes=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];for(let i=0;i<uv.count;i++){const[u,v]=sizes[Math.floor(i/4)];uv.setXY(i,uv.getX(i)*u/4,uv.getY(i)*v/3);}}
    add(g,material,x,y,z,0,0,0,solid);if(solid)colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
  }
  function cylinder(x,y,z,r,h,material=mat.iron,solid=false,rt=r){add(new THREE.CylinderGeometry(rt,r,h,20),material,x,y,z,0,0,0,solid);if(solid)colliders.push({minX:x-r,maxX:x+r,minZ:z-r,maxZ:z+r});}
  function ring(x,y,z,r,t,material=mat.brass,rx=0){add(new THREE.TorusGeometry(r,t,6,32),material,x,y,z,rx);}
  function sphere(x,y,z,r,material,sx=1,sy=1,sz=1){const g=new THREE.SphereGeometry(r,20,14);g.scale(sx,sy,sz);add(g,material,x,y,z);}
  function lamp(x,y,z,color=infernal?'#ff982f':'#b28eff',intensity=24){
    const l=new THREE.PointLight(color,intensity,19,1.65);l.position.set(x,y,z);scene.add(l);lights.push({light:l,base:intensity,phase:rand()*7});
    sphere(x,y,z,.17,mat.paleGlow);
  }
  function floorPanel(x,z,w,d,material=mat.floor,y=.01){box(x,y-.08,z,w,.16,d,material);}
  function pool(x,z,w,d){
    const g=new THREE.PlaneGeometry(w,d);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/4,uv.getY(i)*d/4);
    add(g,mat.lava,x,.035,z,-Math.PI/2);lavaZones.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
    box(x-w/2-.15,.12,z,.3,.25,d+.5,mat.trim);box(x+w/2+.15,.12,z,.3,.25,d+.5,mat.trim);
    box(x,.12,z-d/2-.15,w+.6,.25,.3,mat.trim);box(x,.12,z+d/2+.15,w+.6,.25,.3,mat.trim);
  }
  function pipe(x,z,h=4,r=1.1){
    cylinder(x,h/2,z,r,h,mat.green,true);cylinder(x,h-.04,z,r*1.18,.4,mat.green);cylinder(x,h+.18,z,r*.85,.035,mat.dark);
    ring(x,.15,z,r,.09,mat.brass,Math.PI/2);ring(x,h-.23,z,r*1.16,.075,mat.brass,Math.PI/2);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;cylinder(x+Math.sin(a)*r*1.05,h+.2,z+Math.cos(a)*r*1.05,.055,.12,mat.brass);}
  }
  function overheadPipe(x,y,z,length,alongX=false,r=.65){add(new THREE.CylinderGeometry(r,r,length,20),mat.green,x,y,z,alongX?0:Math.PI/2,0,alongX?Math.PI/2:0);for(let i=-length/2+1;i<length/2;i+=4){if(alongX)add(new THREE.TorusGeometry(r+.035,.12,6,24),mat.brass,x+i,y,z,0,Math.PI/2);else ring(x,y,z+i,r+.035,.12,mat.brass);}}
  function sign(text,x,y,z,width=6,color='#e9d58e'){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle=infernal?'#1c2b20':'#251c33';c.fillRect(0,0,512,128);c.strokeStyle=color;c.lineWidth=4;c.strokeRect(8,8,496,112);c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.font='bold 40px monospace';c.fillText(text,256,64);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide});add(new THREE.PlaneGeometry(width,width/4),m,x,y,z);
  }
  function bulkhead(x,z,width=8){
    const left=x-width/2,right=x+width/2;
    box((-23+left)/2,4.5,z,left+23,9,1.8,mat.stone,true);box((23+right)/2,4.5,z,23-right,9,1.8,mat.stone,true);
    box(x,7.8,z,width,2.4,1.8,mat.iron);box(left-.2,3.1,z+1,.4,6.2,.4,mat.stripe);box(right+.2,3.1,z+1,.4,6.2,.4,mat.stripe);box(x,6.15,z+1,width+.6,.45,.4,mat.stripe);
    box(x,5.7,z+1.01,width-.6,.07,.05,mat.paleGlow);
  }
  function gothicArch(x,z,width=10,height=11){
    const r=width/2,base=height-r;box(x-r-.55,base/2,z,1.1,base,1.6,mat.trim,true);box(x+r+.55,base/2,z,1.1,base,1.6,mat.trim,true);
    for(let i=0;i<14;i++){const a=(i+.5)*Math.PI/14;add(new THREE.BoxGeometry(1.1,r*Math.PI/14+.1,1.65),mat.trim,x+Math.cos(a)*(r+.5),base+Math.sin(a)*(r+.5),z,0,0,a,true);}
    for(const side of[-1,1]){box(x+side*(r+.55),.25,z,1.7,.5,2,mat.dark);add(new THREE.ConeGeometry(.8,2.2,5),mat.iron,x+side*(r+.55),height+.5,z);}
  }
  function finishBatches(){
    for(const{material,solid,geometries}of batches.values()){
      const mesh=new THREE.Mesh(mergeGeometries(geometries,false),material);mesh.castShadow=solid;mesh.receiveShadow=true;mesh.userData.solid=solid;scene.add(mesh);if(solid)shootables.push(mesh);geometries.forEach(g=>g.dispose());
    }
  }
  function ghostStatue(x,z){
    cylinder(x,.45,z,1.1,.9,mat.trim,true);sphere(x,2,z,1,mat.ivory,1,1.1,.85);
    for(const s of[-1,1]){sphere(x+s*.28,2.2,z+.78,.13,mat.dark,.5,1.5,.3);sphere(x+s*.95,1.9,z,.35,mat.ivory,1.3,.4,.5);}
    sphere(x,1.68,z+.82,.25,mat.dark,1,.7,.2);
  }

  // The walking plane is continuous. Only explicitly authored lava rectangles
  // hurt the player, so bridge visuals and player collision always agree.
  floorPanel(0,-16.5,46,97);
  for(const side of[-1,1]){box(side*23,6,-16.5,1.2,12,97,mat.stone,true);box(side*22.2,.22,-16.5,.4,.45,97,mat.trim);}
  box(0,6,32,46,12,1.2,mat.stone,true);box(0,6,-65,46,12,1.2,mat.stone,true);
  let enemySpawns,pickupSpawns,navigationGates,secret,zones,menuCamera;

  if(infernal){
    // A low industrial ceiling and offset blast doors make this course feel
    // completely different from the open castle. Follow the yellow service lane.
    box(0,10.5,-16.5,46,1,97,mat.dark);
    for(let z=-60;z<32;z+=9){box(0,9.7,z,46,.65,.75,mat.iron);for(const side of[-1,1]){box(side*21.7,4.6,z,1.2,9.2,1.2,mat.iron);box(side*21.05,5.7,z,.06,.2,2.2,mat.glow);}}
    bulkhead(-11,-7,8);bulkhead(11,-37,8);navigationGates=[{x:-11,z:-7},{x:11,z:-37}];
    sign('INTAKE / 01',0,7.9,30.9,8);sign('SERVICE ROUTE',-11,7.5,-5.95,7);sign('TURBINE CONTROL',11,7.5,-35.95,7);
    pool(7,6,22,13);floorPanel(-11,6,6,29,mat.iron,.07);
    for(let z=-4;z<21;z+=3){box(-13.4,.1,z,.15,.035,1.1,mat.brass);box(-8.6,.1,z,.15,.035,1.1,mat.brass);}
    pipe(-18,20,4.4,1.7);pipe(-18,13,3.2,1.25);pipe(18,23,5.8,2);pipe(18,-1,4.3,1.3);
    overheadPipe(-19,7.8,13,31);overheadPipe(18,8.5,9,37);overheadPipe(0,8.6,18,42,true,.8);
    // Pressure gauges, wheel valves and radial spokes sell the factory scale.
    for(const[x,z]of[[-18,20],[18,23],[-18,-19],[18,-29]]){
      ring(x,2.5,z+1.7,.65,.1,mat.red);for(let i=0;i<5;i++){const a=i*Math.PI/5;add(new THREE.BoxGeometry(1.2,.07,.07),mat.red,x,2.5,z+1.7,0,0,a);}sphere(x,2.5,z+1.72,.13,mat.brass);
    }
    lamp(-11,4,4);lamp(14,4,8,'#ff6425',34);
    // Central boiler blocks the straight line, with two broad flank routes.
    cylinder(0,2.6,-22,3.2,5.2,mat.iron,true);cylinder(0,5.3,-22,3.7,.65,mat.green);
    for(const y of[.4,2.4,4.5])ring(0,y,-22,3.25,.11,mat.brass,Math.PI/2);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;box(Math.sin(a)*3.2,2.6,-22+Math.cos(a)*3.2,.35,2.4,.35,mat.glow);}
    overheadPipe(0,7.9,-22,40,true,.9);pipe(-18,-19,4.6,1.5);pipe(18,-29,4,1.5);
    box(-11,1,-23,3.8,2,3,mat.iron,true);box(-11,2.06,-23,4,.14,3.2,mat.stripe);
    box(12,1.2,-16,3.8,2.4,3,mat.iron,true);box(12,2.46,-16,4,.14,3.2,mat.stripe);
    sign('STAR CORE',15,4.2,-29.9,5);lamp(0,6,-22,'#ff7638',28);lamp(14,3,-26,'#8bc98a',19);
    // Walkable grated central bridge through the turbine chamber.
    pool(-12,-50,16,18);pool(12,-50,16,18);floorPanel(0,-50,7.2,27,mat.iron,.07);
    for(let z=-61;z<-39;z+=.75)box(0,.18,z,7.2,.065,.08,mat.brass);
    for(const side of[-1,1]){
      cylinder(side*17,3,-48,2.2,6,mat.green,true);ring(side*17,6.05,-48,2.3,.18,mat.brass,Math.PI/2);cylinder(side*17,6.15,-48,1.9,.05,mat.dark);
      overheadPipe(side*18,7.7,-48,24);
      const fan=new THREE.Group();fan.position.set(side*17,6.35,-48);for(let i=0;i<5;i++){const blade=new THREE.Mesh(new THREE.BoxGeometry(3.1,.1,.55),mat.iron);blade.rotation.y=i*Math.PI/5;fan.add(blade);}scene.add(fan);rotating.push({mesh:fan,axis:'y',speed:1.6});
      box(side*6,1.1,-58,2,2.2,2,mat.iron,true);
    }
    lamp(0,5,-49,'#ff8a30',33);
    // Steam rises above the valves, remaining visual rather than opaque cover.
    for(const[x,z]of[[-18,13],[18,-29],[-17,-48],[17,-48]])for(let i=0;i<20;i++)steam.push({x:x+(rand()-.5)*.6,y:1+rand()*8,z:z+(rand()-.5)*.6,speed:.8+rand()});
    enemySpawns=[{type:'goomba',x:-4,z:17},{type:'koopa',x:-11,z:8},{type:'goomba',x:16,z:17},{type:'boo',x:-17,z:1},{type:'koopa',x:-9,z:-14},{type:'goomba',x:7,z:-19},{type:'boo',x:-14,z:-28},{type:'koopa',x:15,z:-25},{type:'goomba',x:10,z:-32},{type:'koopa',x:0,z:-43},{type:'boo',x:3,z:-50},{type:'goomba',x:-2,z:-56},{type:'koopa',x:0,z:-59}];
    pickupSpawns=[{type:'ammo',x:-3,z:23},{type:'armor',x:-17,z:27},{type:'health',x:-17,z:8},{type:'ammo',x:-11,z:-3},{type:'ammo',x:-7,z:-18},{type:'health',x:-16,z:-32},{type:'key',x:15,z:-26},{type:'ammo',x:14,z:-31},{type:'armor',x:19,z:-35},{type:'health',x:1,z:-40},{type:'ammo',x:2,z:-49},{type:'health',x:-2,z:-59}];
    secret={x:20,z:28,radius:1.8};zones=[{name:'THE INTAKE FURNACE',minZ:-7},{name:'THE PRESSURE CHAMBER',minZ:-37},{name:'THE TURBINE BRIDGE',minZ:-65}];menuCamera={position:[-2,5,26],target:[-11,3,-5]};
  }else{
    // Midnight nave: a moonlit procession through haunted chapels and a star
    // furnace, ending in a broad boss arena. Tall arches leave a readable route.
    for(const side of[-1,1]){
      for(let z=23;z>-60;z-=10){
        cylinder(side*18,5.5,z,.9,11,mat.trim,true);cylinder(side*18,.3,z,1.3,.6,mat.dark);cylinder(side*18,10.8,z,1.35,.5,mat.iron);
        add(new THREE.ConeGeometry(1.4,3.2,5),mat.iron,side*18,12.65,z);
        box(side*22.3,7,z,.05,5,2.5,mat.glow);
        for(let i=-1;i<=1;i++)box(side*22.24,7,z+i*.6,.1,5,.08,mat.dark);
      }
      box(side*14,5,-7,18,10,2,mat.stone,true);box(side*16.5,5,-37,13,10,2,mat.stone,true);
      ghostStatue(side*9,5);ghostStatue(side*12,-34);
      for(const z of[17,-18,-46]){box(side*11,.65,z,3.3,1.3,2.5,mat.trim,true);box(side*11,1.4,z,3.6,.25,2.8,mat.iron);box(side*11,1.57,z,.25,.12,1.7,mat.brass);}
    }
    gothicArch(0,-7,10,11);gothicArch(0,-37,18,14);navigationGates=[{x:0,z:-7},{x:0,z:-37}];
    for(const z of[22,11,-14,-30]){gothicArch(0,z,30,17);box(0,17.8,z,38,.5,1.5,mat.dark);}
    floorPanel(0,9,8,43,mat.red,.015);
    sign('THE LAST CASTLE',0,9.6,-5.9,9,'#d7b4ed');lamp(-8,5,-4,'#a97deb',24);lamp(8,5,-4,'#91b7ff',24);
    // Broken star engine: crystals orbit above a wide, solid ritual pedestal.
    cylinder(0,.6,-22,4.1,1.2,mat.dark,true);cylinder(0,1.3,-22,3.7,.2,mat.lava);ring(0,1.5,-22,3.9,.16,mat.brass,Math.PI/2);
    const core=new THREE.Mesh(new THREE.OctahedronGeometry(1.35,0),mat.paleGlow);core.position.set(0,5.2,-22);scene.add(core);rotating.push({mesh:core,axis:'y',speed:.5,bob:true,baseY:5.2});
    const orbit=new THREE.Group();orbit.position.set(0,5,-22);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;const shard=new THREE.Mesh(new THREE.OctahedronGeometry(.48,0),mat.glow);shard.position.set(Math.sin(a)*3.2,Math.sin(a*2)*.7,Math.cos(a)*3.2);orbit.add(shard);}
    scene.add(orbit);rotating.push({mesh:orbit,axis:'y',speed:-.23});lamp(0,4,-22,'#b788ff',40);
    ring(0,7.5,-22,4.7,.07,mat.paleGlow,Math.PI/2);ring(0,7.5,-22,5.5,.06,mat.glow,Math.PI/2);
    sign('STAR RELIQUARY',-13,4,-25,6,'#d9b5ee');
    for(const side of[-1,1]){
      pool(side*18,-50,6,18);box(side*13,1.1,-51,3,2.2,2.6,mat.stone,true);
      cylinder(side*12,6.5,-60,2.4,13,mat.trim,true);cylinder(side*12,13.1,-60,2.9,.4,mat.iron);
      add(new THREE.ConeGeometry(3.2,6.7,8),mat.dark,side*12,16.6,-60);
      lamp(side*10,4.5,-45,'#c563a6',22);
    }
    floorPanel(0,-51,12,26,mat.dark,.02);ring(0,.045,-51,7.2,.06,mat.brass,Math.PI/2);ring(0,.055,-51,5.6,.035,mat.glow,Math.PI/2);
    // Distant royal spires silhouette against a pale, cratered moon.
    for(let i=0;i<12;i++){const x=-65+i*12,h=17+rand()*22;box(x,h/2,-87,8,h,10,mat.dark);add(new THREE.ConeGeometry(5,10,5),mat.dark,x,h+5,-87);}
    const moonMat=new THREE.MeshBasicMaterial({color:'#c6b3d5',fog:false});const moon=new THREE.Mesh(new THREE.CircleGeometry(14,64),moonMat);moon.position.set(-26,38,-110);scene.add(moon);
    const craterMat=new THREE.MeshBasicMaterial({color:'#9585ac',fog:false,transparent:true,opacity:.32});
    for(let i=0;i<14;i++){const a=rand()*Math.PI*2,r=rand()*10;const crater=new THREE.Mesh(new THREE.CircleGeometry(.7+rand()*2.2,20),craterMat);crater.position.set(-26+Math.cos(a)*r,38+Math.sin(a)*r,-109.95);scene.add(crater);}
    enemySpawns=[{type:'boo',x:-5,z:17},{type:'goomba',x:4,z:12},{type:'koopa',x:12,z:5},{type:'boo',x:-11,z:-1},{type:'boo',x:7,z:-17},{type:'koopa',x:-8,z:-25},{type:'goomba',x:11,z:-29},{type:'boo',x:-13,z:-27},{type:'koopa',x:6,z:-42},{type:'boo',x:-7,z:-44},{type:'goomba',x:9,z:-56},{type:'bowser',x:0,z:-52}];
    pickupSpawns=[{type:'ammo',x:2,z:21},{type:'armor',x:-14,z:25},{type:'health',x:13,z:9},{type:'ammo',x:-4,z:-3},{type:'health',x:12,z:-15},{type:'key',x:-13,z:-23},{type:'ammo',x:-13,z:-30},{type:'armor',x:14,z:-33},{type:'health',x:-5,z:-40},{type:'ammo',x:5,z:-44},{type:'ammo',x:-7,z:-55},{type:'health',x:8,z:-59}];
    secret={x:-20,z:27,radius:1.8};zones=[{name:'THE MOONLIT NAVE',minZ:-7},{name:'THE STAR RELIQUARY',minZ:-37},{name:'BOWSER’S LAST STAND',minZ:-65}];menuCamera={position:[10,6,25],target:[0,4,-17]};
  }

  // Every course ends at a conspicuous warp gate; its rule is returned as data.
  floorPanel(0,-61,9,7,mat.trim,.06);
  for(const side of[-1,1])box(side*3.3,3,-62,1,6,1.4,mat.trim,true);
  box(0,6.2,-62,7.6,.7,1.6,mat.iron);sign(infernal?'WARP / CITADEL':'THE WAY HOME',0,7.5,-61.9,7.5,infernal?'#a9e5b9':'#ffe0a8');
  const portalColor=infernal?'#6ce0a2':'#f3d098';
  const portalMaterial=new THREE.MeshBasicMaterial({color:portalColor,transparent:true,opacity:.52,side:THREE.DoubleSide});
  const portal=new THREE.Mesh(new THREE.PlaneGeometry(5.5,5.8),portalMaterial);portal.position.set(0,3,-62);scene.add(portal);
  const portalRing=new THREE.Mesh(new THREE.TorusGeometry(2.1,.1,8,64),new THREE.MeshBasicMaterial({color:portalColor}));portalRing.position.set(0,3,-61.8);scene.add(portalRing);
  lamp(0,3,-59,infernal?'#63ffaa':'#ffd493',26);
  const particlePositions=new Float32Array((infernal?steam.length:260)*3);
  if(!infernal)for(let i=0;i<260;i++)steam.push({x:(rand()-.5)*44,y:rand()*16,z:30-rand()*94,speed:.15+rand()*.25});
  steam.forEach((p,i)=>{particlePositions[i*3]=p.x;particlePositions[i*3+1]=p.y;particlePositions[i*3+2]=p.z;});
  const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));
  const motes=new THREE.Points(particleGeo,new THREE.PointsMaterial({color:infernal?'#b4d0b0':'#d1b6f4',size:infernal?.18:.05,transparent:true,opacity:infernal?.2:.7,depthWrite:false}));scene.add(motes);
  finishBatches();
  return {
    name:infernal?'THE INFERNAL PIPEWORKS':'THE MIDNIGHT CITADEL',
    subtitle:infernal?'Follow the service lanes. Steal the furnace’s Power Star.':'Break the star furnace. End Bowser’s reign.',
    requiresBoss:!infernal,colliders,shootables,mapBounds,spawn:{x:0,z:24},enemySpawns,pickupSpawns,exit:{x:0,z:-60},lavaZones,
    navigationGates,gates:infernal?[]:[-7,-37],secret,zones,menuCamera,
    theme:{fogColor:infernal?'#26372b':'#2b253e',fogDensity:infernal?.021:.014,skyVisible:!infernal,hemisphereColor:infernal?'#bdd5ae':'#c6b9e5',sunColor:infernal?'#dfa663':'#b9b9ee'},
    update(dt,time){
      lavaTexture.offset.x=time*.019;lavaTexture.offset.y=time*.011;
      for(const item of rotating){item.mesh.rotation[item.axis]=time*item.speed;if(item.bob)item.mesh.position.y=item.baseY+Math.sin(time*1.1)*.2;}
      for(const item of lights)item.light.intensity=item.base*(.94+Math.sin(time*3+item.phase)*.06);
      portalMaterial.opacity=.45+Math.sin(time*2)*.09;portalRing.rotation.z=time*.17;
      steam.forEach((p,i)=>{p.y+=dt*p.speed;if(p.y>(infernal?9:17))p.y=infernal?1:0;particlePositions[i*3+1]=p.y;particlePositions[i*3]=p.x+Math.sin(time*.9+i)*.15;});particleGeo.attributes.position.needsUpdate=true;
    },
  };
}
