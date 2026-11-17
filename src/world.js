import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createAdditionalLevel } from './levels.js';

// An authored arena, with three readable landmarks and a continuous route north.
// Static architecture is combined by material; collision remains deliberately simple.
export function createWorld(scene, index = 0) {
  if (index > 0) return createAdditionalLevel(scene, index);
  const colliders = [], shootables = [], batches = new Map(), animated = [];
  const mapBounds = { minX: -23, maxX: 23, minZ: -65, maxZ: 32 };
  let seed = 7421;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  function paintedTexture(kind) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const c = canvas.getContext('2d');
    if (kind === 'stone' || kind === 'floor') {
      c.fillStyle = kind === 'stone' ? '#292d25' : '#262820'; c.fillRect(0, 0, 512, 512);
      const bh = kind === 'stone' ? 64 : 128, bw = kind === 'stone' ? 128 : 128;
      for (let row = -1; row < 9; row++) for (let col = -1; col < 6; col++) {
        const x = col * bw + (row % 2) * bw / 2, y = row * bh;
        const v = Math.floor(46 + rand() * 27);
        c.fillStyle = `rgb(${v},${v+2},${v-7})`; c.fillRect(x + 3, y + 3, bw - 6, bh - 6);
        c.fillStyle = '#ffffff0d'; c.fillRect(x + 4, y + 3, bw - 8, 2);
        c.fillStyle = '#00000033'; c.fillRect(x + 4, y + bh - 5, bw - 6, 3);
        for (let j = 0; j < 180; j++) { c.fillStyle = rand() > .5 ? '#ffffff09' : '#00000016'; c.fillRect(x+rand()*bw,y+rand()*bh,rand()*8+1,rand()*3+1); }
        if (rand() > .72) { c.strokeStyle = '#11160f55'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x+30,y+4); c.lineTo(x+45,y+bh*.42); c.lineTo(x+36,y+bh-5); c.stroke(); }
      }
    } else if (kind === 'banner') {
      c.fillStyle = '#701f12'; c.fillRect(0,0,512,512);
      for(let i=0;i<90;i++){ c.fillStyle = '#00000008'; c.fillRect(i*6,0,3,512); }
      c.strokeStyle='#b9813d'; c.lineWidth=13; c.strokeRect(27,18,458,476);
      c.fillStyle='#c5a06a'; c.textAlign='center'; c.font='bold 270px Georgia'; c.fillText('M',256,351);
      c.fillStyle='#36150c'; c.beginPath(); c.moveTo(90,90); c.lineTo(160,120); c.lineTo(256,52); c.lineTo(350,120); c.lineTo(420,90); c.lineTo(390,160); c.lineTo(122,160); c.fill();
    } else if (kind === 'question') {
      c.fillStyle='#926320'; c.fillRect(0,0,512,512); c.strokeStyle='#372717'; c.lineWidth=22; c.strokeRect(14,14,484,484);
      c.fillStyle='#d2ab53'; c.fillRect(30,30,452,8); c.fillStyle='#352612'; c.textAlign='center'; c.font='bold 370px Georgia'; c.fillText('?',267,397);
      for(const x of [53,459]) for(const y of [53,459]){c.fillStyle='#3e301d';c.beginPath();c.arc(x,y,12,0,Math.PI*2);c.fill();}
    } else if (kind === 'lava') {
      c.fillStyle='#e15309';c.fillRect(0,0,512,512);
      for(let i=0;i<110;i++){const x=rand()*512,y=rand()*512; c.fillStyle=rand()>.65?'#ffce3a':'#4b1a09';c.beginPath();c.ellipse(x,y,rand()*60+12,rand()*15+3,rand()*3,0,7);c.fill();}
      c.strokeStyle='#ffac18';c.lineWidth=7;
      for(let i=0;i<13;i++){c.beginPath();c.moveTo(0,i*42);for(let x=0;x<560;x+=30)c.lineTo(x,i*42+Math.sin(x*.04+i)*10);c.stroke();}
    }
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
    return tex;
  }
  const stoneTex=paintedTexture('stone'), floorTex=paintedTexture('floor'), lavaTex=paintedTexture('lava');
  const mats = {
    stone: new THREE.MeshStandardMaterial({map:stoneTex,bumpMap:stoneTex,bumpScale:.15,roughness:.98,color:'#a1a48d'}),
    trim: new THREE.MeshStandardMaterial({color:'#57584b',roughness:.95}),
    dark: new THREE.MeshStandardMaterial({color:'#171b16',roughness:.92}),
    floor: new THREE.MeshStandardMaterial({map:floorTex,bumpMap:floorTex,bumpScale:.12,roughness:.94,color:'#72745d'}),
    metal: new THREE.MeshStandardMaterial({color:'#263529',roughness:.55,metalness:.72}),
    pipe: new THREE.MeshStandardMaterial({color:'#344d2e',roughness:.53,metalness:.62}),
    pipeRim: new THREE.MeshStandardMaterial({color:'#637153',roughness:.48,metalness:.7}),
    brass: new THREE.MeshStandardMaterial({color:'#9e7537',roughness:.42,metalness:.65}),
    red: new THREE.MeshStandardMaterial({color:'#9e281c',roughness:.86}),
    ivory: new THREE.MeshStandardMaterial({color:'#b7af89',roughness:.91}),
    window: new THREE.MeshBasicMaterial({color:'#e46a18'}),
    wood: new THREE.MeshStandardMaterial({color:'#4b3320',roughness:.95}),
    banner: new THREE.MeshStandardMaterial({map:paintedTexture('banner'),side:THREE.DoubleSide,roughness:1}),
    question: new THREE.MeshStandardMaterial({map:paintedTexture('question'),roughness:.7}),
    lava: new THREE.MeshBasicMaterial({map:lavaTex,color:'#ff8f22'}),
  };
  const temp = new THREE.Object3D();
  function add(geometry, material, x,y,z, rx=0,ry=0,rz=0, solid=false) {
    temp.position.set(x,y,z);temp.rotation.set(rx,ry,rz);temp.scale.set(1,1,1);temp.updateMatrix();
    geometry.applyMatrix4(temp.matrix);
    const key = material.uuid+(solid?'solid':'decor');
    if(!batches.has(key))batches.set(key,{material,solid,geometries:[]});
    batches.get(key).geometries.push(geometry);
  }
  function box(x,y,z,w,h,d,material=mats.stone,collide=false, rotation=0) {
    const geom=new THREE.BoxGeometry(w,h,d);
    if(material===mats.stone || material===mats.floor){
      // BoxGeometry stores four vertices per face. Match the masonry scale to
      // each face's actual dimensions, including the short ends of long walls.
      const uv=geom.attributes.uv, faceSizes=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
      for(let i=0;i<uv.count;i++){const [u,v]=faceSizes[Math.floor(i/4)];uv.setXY(i,uv.getX(i)*u/4,uv.getY(i)*v/3);}
      uv.needsUpdate=true;
    }
    add(geom,material,x,y,z,0,rotation,0,collide);
    if(collide)colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
  }
  function cyl(x,y,z,r,h,mat=mats.stone,segments=20,rTop=r,solid=false) {add(new THREE.CylinderGeometry(rTop,r,h,segments),mat,x,y,z,0,0,0,solid);}
  function sphere(x,y,z,r,mat,sx=1,sy=1,sz=1){const g=new THREE.SphereGeometry(r,20,12);g.scale(sx,sy,sz);add(g,mat,x,y,z);}
  function ring(x,y,z,r,t,mat=mats.trim,vertical=false){add(new THREE.TorusGeometry(r,t,6,28),mat,x,y,z,vertical?0:Math.PI/2);}
  function arch(x,z,width=8,height=8,depth=2) {
    const r=width/2,base=height-r;
    box(x-r-.65,base/2,z,1.3,base,depth,mats.stone,true);box(x+r+.65,base/2,z,1.3,base,depth,mats.stone,true);
    for(let i=0;i<13;i++){const a=(i+.5)*Math.PI/13;add(new THREE.BoxGeometry(1.3,r*Math.PI/13+.12,depth+.1),mats.trim,x+Math.cos(a)*(r+.6),base+Math.sin(a)*(r+.6),z,0,0,a,true);}
    box(x-r-.65,.22,z,1.7,.44,depth+.5,mats.trim);box(x+r+.65,.22,z,1.7,.44,depth+.5,mats.trim);
  }
  function banner(x,z,y=7,w=2.1,h=4.3){
    add(new THREE.PlaneGeometry(w,h,1,1),mats.banner,x,y,z);
    add(new THREE.CylinderGeometry(.07,.07,w+.5,8),mats.brass,x,y+h/2+.08,z,0,0,Math.PI/2);
  }
  function pipe(x,z,h=3,r=1.1) {
    cyl(x,h/2,z,r,h,mats.pipe,20,r,true);cyl(x,h-.08,z,r*1.16,.35,mats.pipeRim);cyl(x,h+.105,z,r*.89,.04,mats.dark);
    ring(x,.15,z,r,.09,mats.pipeRim);ring(x,h-.27,z,r*1.17,.065,mats.brass);
    for(let j=0;j<5;j++)cyl(x+Math.cos(j*1.26)*r*.99,h-.08,z+Math.sin(j*1.26)*r*.99,.055,.45,mats.brass,6);
    colliders.push({minX:x-r,maxX:x+r,minZ:z-r,maxZ:z+r});
  }
  function mushroom(x,z,s=1) {
    cyl(x,1.6*s,z,.48*s,3.2*s,mats.ivory,16,.68*s,true);
    const cap=new THREE.SphereGeometry(2.25*s,28,14,0,Math.PI*2,0,Math.PI*.54);cap.scale(1,.55,1);add(cap,mats.red,x,3*s,z,0,0,0,true);
    cyl(x,2.96*s,z,2.2*s,.14*s,mats.ivory,28);
    // Place each spot on the actual ellipsoidal cap, with its short axis normal
    // to the surface. Front-facing spots keep the silhouette recognizably Mario.
    const spots=[[0,0,.48],[.62,.35,.44],[.65,2.4,.42],[.68,4.6,.46],[1.13,0,.42],[1.12,1.3,.4],[1.11,2.7,.41],[1.1,4,.4],[1.15,5.2,.42]];
    for(const [theta,phi,radius]of spots){
      const capX=2.25*s*Math.sin(theta)*Math.sin(phi),capY=2.25*.55*s*Math.cos(theta),capZ=2.25*s*Math.sin(theta)*Math.cos(phi);
      const normal=new THREE.Vector3(capX/(2.25*s)**2,capY/(2.25*.55*s)**2,capZ/(2.25*s)**2).normalize();
      const spot=new THREE.SphereGeometry(radius*s,18,10);spot.scale(1,.18,1);
      spot.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal));
      add(spot,mats.ivory,x+capX+normal.x*.025*s,3*s+capY+normal.y*.025*s,z+capZ+normal.z*.025*s);
    }
    colliders.push({minX:x-.55*s,maxX:x+.55*s,minZ:z-.55*s,maxZ:z+.55*s});
  }
  const flames=[];
  function torch(x,z,y=3.7,light=false) {
    box(x,y-.45,z,.18,1,.18,mats.metal);cyl(x,y-.02,z,.26,.28,mats.brass,10,.38);
    const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(.3,1),new THREE.MeshBasicMaterial({color:'#ff9c32'}));flame.position.set(x,y+.35,z);flame.scale.set(.7,1.8,.7);scene.add(flame);flames.push(flame);
    const inner=new THREE.Mesh(new THREE.IcosahedronGeometry(.18,0),new THREE.MeshBasicMaterial({color:'#ffe8aa'}));inner.position.set(x,y+.25,z);inner.scale.y=1.7;scene.add(inner);flames.push(inner);
    if(light){const l=new THREE.PointLight('#ff8a35',27,17,1.7);l.position.set(x,y+.6,z);scene.add(l);animated.push({light:l,phase:rand()*6});}
  }

  // Flagstone floor, with recessed magma channels at the courtyard's edges.
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(46,97),mats.floor.clone());floor.material.map=floorTex.clone();floor.material.map.repeat.set(10,22);floor.material.bumpMap=floor.material.map;floor.rotation.x=-Math.PI/2;floor.position.set(0,-.03,-16.5);floor.receiveShadow=true;scene.add(floor);
  const channelTex=lavaTex.clone();channelTex.repeat.set(1,20);
  const channelMaterial=mats.lava.clone();channelMaterial.map=channelTex;
  box(0,-.35,-16.5,46,.6,97,mats.dark);
  for(const side of [-1,1]) {
    box(side*23,5,-16.5,1.2,10,97,mats.stone,true);
    box(side*22.9,9.9,-16.5,1.8,.4,97,mats.trim);
    for(let z=-63;z<33;z+=5) {box(side*22.8,10.6,z,1.6,1.3,2,mats.stone);box(side*22.25,4.2,z,1,8.4,1.25,mats.trim);}
    const channel=new THREE.Mesh(new THREE.PlaneGeometry(3.5,88),channelMaterial);channel.rotation.x=-Math.PI/2;channel.position.set(side*20.2,.012,-14);scene.add(channel);
    box(side*18.25,.18,-14,.4,.36,88,mats.trim);box(side*22.12,.18,-14,.4,.36,88,mats.trim);
    for(let z=-54;z<31;z+=14){box(side*20.2,.16,z,4.4,.3,2.1,mats.metal);for(let i=0;i<7;i++)box(side*20.2,.33,z-.9+i*.3,4.4,.07,.08,mats.brass);}
    for(let z=-60;z<29;z+=14){box(side*22.3,6.5,z, .25,2.4,1.1,mats.window);}
  }
  box(0,4.6,32,46,9.2,1.2,mats.stone,true);box(0,5,-65,46,10,1.2,mats.stone,true);

  // First vista: shattered castle gate, ornamental masonry, giant fungal growth.
  for(const side of [-1,1]) {
    box(side*13.8,5,-7,18.4,10,2,mats.stone,true);
    box(side*13.8,10,-7,19.1,.45,2.8,mats.trim);
    for(let x=6;x<23;x+=3.1)box(side*x,10.7,-7,1.5,1.4,2.3,mats.stone);
    for(let x=7;x<23;x+=7){box(side*x,5,-5.72,1.05,10,1.2,mats.trim);banner(side*x,-5.05,7.3,2.2,4.1);}
    torch(side*4.7,-5.4,4.2,true);
  }
  arch(0,-7,8,9.2,2.8);
  // A raised glowing crest crowns the first gate.
  const crest=new THREE.Mesh(new THREE.TorusGeometry(1.05,.11,8,32),mats.brass);crest.position.set(0,10,-5.45);scene.add(crest);
  banner(0,-5.43,10,1.25,1.6);
  mushroom(-11,10,1.45);mushroom(-14.3,8.5,.7);mushroom(13.5,-.3,1.05);
  pipe(12,17,3.4,1.4);pipe(15,18,2.2,.9);pipe(-15,23,2.8,1.15);
  // A dry royal fountain, now lit from within by lava.
  cyl(-6,.35,1.4,2.5,.7,mats.trim,24,2.5,true);cyl(-6,.72,1.4,2.15,.13,mats.lava,24);cyl(-6,1.1,1.4,.7,1.25,mats.stone,20,.7,true);
  ring(-6,.78,1.4,2.38,.15,mats.brass);colliders.push({minX:-8.4,maxX:-3.6,minZ:-1,maxZ:3.8});
  box(7,.8,8,1.6,1.6,1.6,mats.question,true);box(8.7,.6,7.9,1.1,1.2,1.2,mats.wood,true);box(7,2.15,8,1.1,1.1,1.1,mats.question);
  for(let i=0;i<11;i++){const x=(rand()>.5?1:-1)*(8+rand()*8),z=15-rand()*17;box(x,.15,z,.4+rand()*.7,.3, .4+rand()*.7,mats.trim,false,rand()*3);}

  // Pipeworks: alternating cover and brick arcades create multiple combat ranges.
  for(const side of [-1,1]) {
    for(const z of [-17,-29]) {
      box(side*11.3,1.35,z,4.7,2.7,3.2,mats.stone,true);
      box(side*11.3,2.8,z,5,.25,3.5,mats.trim);
    }
    pipe(side*15.7,-22,4.8,1.25);pipe(side*17,-30,2.3,.85);
    add(new THREE.CylinderGeometry(.65,.65,14,18),mats.pipe,side*17.3,6.5,-22,Math.PI/2);
    for(const z of [-28,-22,-16])add(new THREE.TorusGeometry(.68,.12,6,18),mats.pipeRim,side*17.3,6.5,z);
    torch(side*16.5,-17,3.9,side===-1);
    box(side*20.8,4.8,-23,3.6,.65,17,mats.metal);
    banner(side*14,-8.05,6,2.4,4.1);
    for(const z of [-12,-31])box(side*6,.5,z,1,1,1,mats.question,true);
  }
  // Cross-beams and hanging chains, high enough to preserve every player route.
  box(0,7.3,-23,37,.6,.7,mats.metal);box(0,7.3,-14,37,.6,.7,mats.metal);
  for(const x of [-8,8])for(let i=0;i<9;i++)add(new THREE.TorusGeometry(.13,.035,5,8),mats.brass,x,7.1-i*.25,-23,0,i%2*Math.PI/2);
  // Second arch is deliberately wider: the final encounter is visible from afar.
  for(const side of [-1,1]){box(side*15,4.5,-37,16,9,2,mats.stone,true);box(side*15,9,-37,16.6,.4,2.6,mats.trim);torch(side*7,-35.6,4.8,true);banner(side*12,-35.8,6,2.7,4.5);}
  arch(0,-37,12,9,2.3);

  // The throne court has a sweeping clear central combat space and tall towers.
  for(const side of [-1,1]){
    cyl(side*16.5,8,-57,3.6,16,mats.stone,24,3.6,true);cyl(side*16.5,16,-57,4.1,.7,mats.trim,24);
    add(new THREE.ConeGeometry(4.5,8,24),mats.pipe,side*16.5,20.3,-57);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;box(side*16.5+Math.cos(a)*3.65,16.8,-57+Math.sin(a)*3.65,1,1.8,1,mats.stone);}
    colliders.push({minX:side*16.5-3.6,maxX:side*16.5+3.6,minZ:-60.6,maxZ:-53.4});
    box(side*16.5,11,-53.35,.85,2.3,.05,mats.window);
    mushroom(side*11,-43,.85);
    box(side*9,1.05,-51,3.2,2.1,2.2,mats.stone,true);box(side*9,2.2,-51,3.5,.3,2.5,mats.trim);
    pipe(side*17,-46,2.2,1.15);
  }
  // Exit sanctuary: an animated emerald warp portal in a stone frame.
  box(0,.12,-60,10,.24,6,mats.trim);arch(0,-62.5,5.4,7.2,1.3);
  const portalMat=new THREE.MeshBasicMaterial({color:'#68d8a8',transparent:true,opacity:.55,side:THREE.DoubleSide});
  const portal=new THREE.Mesh(new THREE.PlaneGeometry(5,5.7),portalMat);portal.position.set(0,3,-62.35);scene.add(portal);
  const portalRing=new THREE.Mesh(new THREE.TorusGeometry(2.1,.09,8,64),new THREE.MeshBasicMaterial({color:'#baffc9'}));portalRing.position.set(0,3,-62.1);scene.add(portalRing);
  const portalLight=new THREE.PointLight('#63ffab',30,13,1.6);portalLight.position.set(0,3,-60);scene.add(portalLight);

  // Silhouettes beyond the map make the playable space feel part of a city.
  for(let i=0;i<16;i++){
    const x=-80+i*11, height=12+rand()*23,z=-82-rand()*15;
    box(x,height/2,z,7+rand()*4,height,9,mats.dark);
    add(new THREE.ConeGeometry(5,7+rand()*7,4),mats.dark,x,height+4,z,0,Math.PI/4);
    if(i%3===0){box(x,height*.7,z+4.55,.9,2.3,.1,mats.window);box(x-2,height*.6,z+4.55,.65,1.7,.1,mats.window);}
  }
  // A disc behind the skyline, rendered as an ember sun through the fog.
  const sun = new THREE.Mesh(new THREE.CircleGeometry(10,64), new THREE.MeshBasicMaterial({color:'#b85327',fog:false}));sun.position.set(34,38,-119);scene.add(sun);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(13,64),new THREE.MeshBasicMaterial({color:'#943b22',transparent:true,opacity:.2,fog:false}));halo.position.set(34,38,-119.2);scene.add(halo);

  // Fine drifting ash catches highlights without sprite texture downloads.
  const count=450,positions=new Float32Array(count*3),speeds=new Float32Array(count);
  for(let i=0;i<count;i++){positions[i*3]=(rand()-.5)*47;positions[i*3+1]=rand()*17;positions[i*3+2]=32-rand()*100;speeds[i]=.12+rand()*.45;}
  const ashGeom=new THREE.BufferGeometry();ashGeom.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const ash = new THREE.Points(ashGeom,new THREE.PointsMaterial({color:'#ffa568',size:.045,transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(ash);

  for(const {material,solid,geometries} of batches.values()){
    const geometry=mergeGeometries(geometries,false);const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=solid;mesh.receiveShadow=true;mesh.userData.solid=solid;scene.add(mesh);if(solid)shootables.push(mesh);for(const g of geometries)g.dispose();
  }
  const enemySpawns=[
    {type:'goomba',x:3,z:12},{type:'goomba',x:-4,z:15},{type:'koopa',x:10,z:1},
    {type:'goomba',x:-12,z:-1},{type:'goomba',x:2,z:-15},{type:'koopa',x:-6,z:-23},
    {type:'goomba',x:8,z:-25},{type:'boo',x:14.8,z:-33},{type:'boo',x:-14.8,z:-31.8},
    {type:'koopa',x:7,z:-43},{type:'goomba',x:-6,z:-44},{type:'boo',x:-5,z:-51},
    {type:'koopa',x:0,z:-53},
  ];
  const pickupSpawns=[
    {type:'ammo',x:2,z:20},{type:'armor',x:-11,z:19},{type:'health',x:11,z:10},
    {type:'ammo',x:-13,z:3},{type:'ammo',x:5,z:-12},{type:'health',x:15,z:-12},
    {type:'armor',x:-15,z:-26},{type:'key',x:0,z:-30},{type:'ammo',x:5,z:-33},
    {type:'health',x:-6,z:-40},{type:'ammo',x:11,z:-47},{type:'health',x:-11,z:-48},
  ];
  return {
    name:'THE ASHEN COURTYARD',subtitle:'Break through the fallen royal gardens.',requiresBoss:false,
    gates:[-7,-37],navigationGates:[{x:0,z:-7},{x:0,z:-37}],secret:{x:-15,z:28,radius:2},
    theme:{fogColor:'#41432f',fogDensity:.016,skyVisible:true,hemisphereColor:'#dfd4a9',sunColor:'#ffd4a0'},
    menuCamera:{position:[11,5.4,25],target:[-1,3,-10]},
    colliders,shootables,mapBounds,spawn:{x:0,z:24},enemySpawns,pickupSpawns,exit:{x:0,z:-60},
    lavaZones:[{minX:-22,maxX:-18.5,minZ:-58,maxZ:30},{minX:18.5,maxX:22,minZ:-58,maxZ:30}],
    zones:[{name:'THE ASHEN COURTYARD',minZ:-7},{name:'THE ROYAL AQUEDUCT',minZ:-37},{name:'THE OUTER SANCTUARY',minZ:-65}],
    update(dt,time){
      lavaTex.offset.x=time*.017;lavaTex.offset.y=time*.009;
      channelTex.offset.x=time*.017;channelTex.offset.y=time*.045;
      for(let i=0;i<flames.length;i++){const f=flames[i];f.scale.y=(i%2?1.7:1.8)+Math.sin(time*13+i*4)*.25;f.rotation.y=time*(i%2?1:-1);}
      for(const a of animated)a.light.intensity=25+Math.sin(time*9+a.phase)*2+Math.sin(time*17+a.phase)*1.5;
      portalMat.opacity=.42+Math.sin(time*2)*.1;portalRing.rotation.z=time*.15;portalRing.scale.setScalar(1+Math.sin(time*1.8)*.035);
      for(let i=0;i<count;i++){positions[i*3+1]+=dt*speeds[i];positions[i*3]+=dt*.08;if(positions[i*3+1]>18)positions[i*3+1]=0;if(positions[i*3]>24)positions[i*3]=-24;}ashGeom.attributes.position.needsUpdate=true;
    },
  };
}
