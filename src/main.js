import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createWorld } from './world.js';
import { createEnemyModel, animateEnemy, createWeaponModel, createPickupModel } from './actors.js';
import { GameAudio } from './audio.js';
import { createUI } from './ui.js';
import { moveCircle, segmentBlocked } from './physics.js';
import { RetroShader, retroResolution } from './retro.js';
import { createRetroSprites } from './retro-sprites.js';
import { CAMPAIGN, campaignTotals, nextLevelInventory } from './campaign.js';
import { PlumberBanter } from './banter.js';
import './style.css';
import './extra.css';

const audio = new GameAudio();
let mode = 'loading', difficulty = 'normal', mapOpen = false, muted = false;
let renderer, composer, bloom, scene, camera, weaponScene, weaponCamera, world;
let weaponPass, retroPass, retroMode = false, retroSprites = null;
let hemisphereLight, sunLight, rimLight;
let worldRoot, skyMesh, levelIndex=0, campaignResults=[], entryInventory=null, bossIntroduced=false;
const originalTextures = new Map(), originalBumps = new Map();
let enemies = [], pickups = [], projectiles = [], particles = [];
let weapons = {}, weaponIndex = 0, shotCooldown = 0, recoil = 0, muzzleTime = 0;
let muzzle, muzzleLight, ambientTime = 0, elapsed = 0, bob = 0, lastTime = 0, uiTick = 0;
let aimYaw = 0, aimPitch = 0, mouseHeld = false, touchFire = false, wasLocked = false;
let damageTime = 0, zoneIndex = 0, secretFound = false, activeToastTime = 0;
let particleGeometry, particleSystem;
const keys = new Set();
const player = { x: 0, z: 24, health: 100, armor: 25, shells: 40, flowers: 60, kills: 0, key: false };
const enemyStats = { goomba: {hp:65,speed:2.1,damage:10}, koopa: {hp:125,speed:1.65,damage:13}, boo: {hp:75,speed:2.6,damage:9}, bowser: {hp:1150,speed:1.25,damage:22} };
const ui = createUI({
  onStart: startGame, onResume: resumeGame, onRestart: restartLevel, onMenu: returnToMenu,
  onBeginLevel: beginLevel, onNextLevel: nextLevel,
  onDifficulty: value => { difficulty = value; },
  onSettings: applySettings,
  onMute: value => { muted = typeof value === 'boolean' ? value : !muted; audio.setMuted(muted);banter.setMuted(muted); },
  onFullscreen: async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { ui.toast('Fullscreen unavailable in this browser'); } },
  onPause: pauseGame, onMap: () => { mapOpen = !mapOpen; syncUI(); },
  onTouch: (key, down) => { if (key === 'Fire') touchFire = down; else if (key === 'Switch' && down) switchWeapon(1-weaponIndex); else if (key === 'KeyE' && down) interact(); else if (down) keys.add(key); else keys.delete(key); },
  onTouchLook: (dx, dy) => touchLookBy(dx, dy),
});
const banter=new PlumberBanter({onLine:text=>ui.say(text)});

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  document.querySelector('#scene').appendChild(renderer.domElement);
  renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';
  renderer.domElement.setAttribute('aria-label', 'Mushroom DOOM 3D game world');
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#343b2c');
  scene.fog = new THREE.FogExp2('#41432f', .016);
  hemisphereLight=new THREE.HemisphereLight('#dfd4a9', '#373d24', 1.6);scene.add(hemisphereLight);
  const sun = new THREE.DirectionalLight('#ffd4a0', 3.2); sun.position.set(-24,42,18);sun.target.position.set(0,0,-17);scene.add(sun.target);scene.add(sun);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=60;sun.shadow.camera.bottom=-60;sun.shadow.camera.near=.5;sun.shadow.camera.far=135;sun.shadow.normalBias=.06;sun.shadow.bias=-.00015;
  sunLight=sun;
  const rim = new THREE.DirectionalLight('#b7ceba', 1.1); rim.position.set(15,10,-40); scene.add(rim);
  rimLight=rim;
  camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, .06, 240);
  camera.rotation.order = 'YXZ';
  const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms:{horizon:{value:new THREE.Vector3(.34,.23,.13)},zenith:{value:new THREE.Vector3(.065,.105,.085)}},
    vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 horizon; uniform vec3 zenith; varying vec3 vPos; void main(){float h=normalize(vPos).y;vec3 col=mix(horizon,zenith,smoothstep(0.,.65,h)); float smoke=sin(vPos.x*.035+sin(vPos.z*.04)*2.)*.01;gl_FragColor=vec4(col+smoke,1.);}',
  })); scene.add(sky);skyMesh=sky;
  worldRoot=new THREE.Group();scene.add(worldRoot);world=createWorld(worldRoot,0);
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .32, .6, .85);
  composer.addPass(bloom);
  weaponScene = new THREE.Scene();
  weaponCamera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .02, 5);
  weaponScene.add(new THREE.HemisphereLight('#fff1cc','#72775e', 3));
  const weaponLight = new THREE.DirectionalLight('#ffe3ba', 4); weaponLight.position.set(-1,2,1); weaponScene.add(weaponLight);
  for (const type of ['shotgun', 'fireflower']) { const m = createWeaponModel(type);m.scale.setScalar(.8); weapons[type] = m; weaponScene.add(m); }
  const glow = document.createElement('canvas'); glow.width = glow.height = 128;
  const ctx = glow.getContext('2d'), gradient = ctx.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'#fffce9'); gradient.addColorStop(.12,'#fff1a9'); gradient.addColorStop(.35,'#ff962baa'); gradient.addColorStop(1,'#ff651000');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  muzzle = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glow),transparent:true,blending:THREE.AdditiveBlending,depthTest:false}));
  muzzle.scale.set(.7,.7,1); weaponScene.add(muzzle);
  muzzleLight = new THREE.PointLight('#ffa23f',0,3); weaponScene.add(muzzleLight);
  weaponPass=new RenderPass(weaponScene,weaponCamera);weaponPass.clear=false;
  const renderWeapon=weaponPass.render.bind(weaponPass);
  weaponPass.render=(render,write,read,...args)=>{render.setRenderTarget(read);render.clearDepth();renderWeapon(render,write,read,...args);};
  composer.addPass(weaponPass);composer.addPass(new OutputPass());
  retroPass=new ShaderPass(RetroShader);retroPass.enabled=false;composer.addPass(retroPass);
  particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(900),3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(900),3));
  particleGeometry.setDrawRange(0,0);
  particleSystem = new THREE.Points(particleGeometry,new THREE.PointsMaterial({size:.11,vertexColors:true,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}));
  particleSystem.frustumCulled=false;scene.add(particleSystem);
  populate(); applySettings(ui.settings);
  mode='menu'; ui.setMode('menu'); syncUI();
  requestAnimationFrame(frame);
}

function disposeModel(model) { model.traverse(child => { if (child.isMesh) child.geometry.dispose(); }); scene.remove(model); }
function clearActors() {
  enemies.forEach(e=>{ disposeModel(e.model); scene.remove(e.shadow);e.shadow.geometry.dispose();e.shadow.material.dispose();if(e.sprite)retroSprites.release(e.sprite); }); pickups.forEach(p=>disposeModel(p.model));
  projectiles.forEach(p=>scene.remove(p.mesh)); projectiles=[];particles=[];
  enemies=[];pickups=[];
}
function populate() {
  clearActors();
  enemies = world.enemySpawns.map((spawn,index)=>{
    const model=createEnemyModel(spawn.type);model.position.set(spawn.x,0,spawn.z);scene.add(model);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(model.userData.radius*1.35,24),new THREE.MeshBasicMaterial({color:'#080b06',transparent:true,opacity:.45,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;shadow.position.set(spawn.x,.015,spawn.z);scene.add(shadow);
    let sprite=null;if(retroSprites){sprite=retroSprites.create(spawn.type);scene.add(sprite);sprite.visible=retroMode;}
    return { ...spawn, model, shadow, sprite, hp:enemyStats[spawn.type].hp, maxHp:enemyStats[spawn.type].hp, attack:1+index*.27, radius:model.userData.radius, height:model.userData.height, dead:false, deadTime:0, awake:false, turn:index%2?1:-1, hurt:0 };
  });
  pickups = world.pickupSpawns.map(spawn=>{
    const model=createPickupModel(spawn.type);model.position.set(spawn.x,.2,spawn.z);scene.add(model);
    return {...spawn,model,collected:false,phase:Math.random()*6};
  });
}

function startGame() {
  difficulty=ui.difficulty || difficulty;
  campaignResults=[];
  prepareLevel(0,{health:difficulty==='easy'?150:100,armor:difficulty==='easy'?50:25,shells:40,flowers:60});
}
function loadWorld(index) {
  clearActors();
  const materials=new Set(),textures=new Set();
  worldRoot.traverse(object=>{if(object.geometry)object.geometry.dispose();if(object.material)for(const m of(Array.isArray(object.material)?object.material:[object.material]))materials.add(m);});
  for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}textures.forEach(t=>t.dispose());
  scene.remove(worldRoot);worldRoot=new THREE.Group();scene.add(worldRoot);
  originalTextures.clear();originalBumps.clear();levelIndex=index;world=createWorld(worldRoot,index);
  const theme=world.theme||{};scene.fog.color.set(theme.fogColor||'#41432f');scene.fog.density=theme.fogDensity??.016;
  scene.background.set(theme.fogColor||'#343b2c');skyMesh.visible=theme.skyVisible!==false;
  skyMesh.material.uniforms.horizon.value.set(...(index===2?[.075,.035,.12]:[.34,.23,.13]));skyMesh.material.uniforms.zenith.value.set(...(index===2?[.008,.012,.035]:[.065,.105,.085]));
  hemisphereLight.color.set(theme.hemisphereColor||'#dfd4a9');sunLight.color.set(theme.sunColor||'#ffd4a0');
  populate();configureRendering();
}
function levelData() {
  const info=CAMPAIGN[levelIndex],totals=campaignTotals(campaignResults);
  return {...info,levelIndex,levelNumber:levelIndex+1,levelCount:CAMPAIGN.length,levelName:info.name,levelSubtitle:info.subtitle,nextLevelName:CAMPAIGN[levelIndex+1]?.name,
    kills:player.kills,total:enemies.length,elapsed,secretFound,campaignKills:totals.kills,campaignTotal:totals.enemies,campaignElapsed:totals.elapsed};
}
function prepareLevel(index,inventory) {
  mode='briefing';keys.clear();mouseHeld=false;touchFire=false;resetTouch();banter.reset();ui.clearBanter();audio.setActive(false);
  if(document.pointerLockElement)document.exitPointerLock();
  loadWorld(index);entryInventory={...inventory};Object.assign(player,inventory,{x:world.spawn.x,z:world.spawn.z,kills:0,key:false});
  aimYaw=0;aimPitch=0;elapsed=0;zoneIndex=0;secretFound=false;bossIntroduced=false;damageTime=0;shotCooldown=.3;recoil=0;mapOpen=false;
  camera.position.set(player.x,1.65,player.z);camera.rotation.set(0,0,0);switchWeapon(0);syncUI();ui.setMode('briefing',levelData());
}
function beginLevel() {
  if(mode!=='briefing')return;
  mode='playing';ui.setMode(mode);audio.init().then(()=>{audio.setActive(mode==='playing');audio.setVolume(ui.settings.volume);audio.setMuted(muted);});
  requestLock();syncUI();notify(`CHAPTER ${levelIndex+1} · ${CAMPAIGN[levelIndex].name}`);banter.play('levelStart',{level:levelIndex});
}
function restartLevel() { if(mode==='dead')prepareLevel(levelIndex,entryInventory); }
function nextLevel() { if(mode==='levelcomplete'&&levelIndex<CAMPAIGN.length-1)prepareLevel(levelIndex+1,nextLevelInventory(player,difficulty)); }
function requestLock() {
  if(matchMedia('(pointer:coarse)').matches){
    // Hide browser chrome and keep landscape so both thumbs have room. Unsupported browsers (e.g. iPhone Safari) just skip this.
    try{const el=document.documentElement;if(!document.fullscreenElement&&el.requestFullscreen)el.requestFullscreen({navigationUI:'hide'}).then(()=>screen.orientation?.lock?.('landscape')).catch(()=>{});}catch{}
    return;
  }
  try { const result=renderer.domElement.requestPointerLock(); if(result?.catch)result.catch(()=>notify('DRAG TO AIM · ARROW KEYS TO TURN')); } catch { notify('DRAG TO AIM · ARROW KEYS TO TURN'); }
}
function pauseGame() {
  if(mode!=='playing')return;
  mode='paused';mouseHeld=false;touchFire=false;resetTouch();keys.clear();ui.setMode('paused');audio.setActive(false);banter.stop();ui.clearBanter();
  if(document.pointerLockElement)document.exitPointerLock();syncUI();
}
function resumeGame() {mode='playing';ui.setMode(mode);audio.setActive(true);shotCooldown=Math.max(shotCooldown,.2);requestLock();syncUI();}
function returnToMenu() {mode='menu';mouseHeld=false;touchFire=false;resetTouch();keys.clear();audio.setActive(false);banter.stop();ui.clearBanter();if(document.pointerLockElement)document.exitPointerLock();if(levelIndex!==0)loadWorld(0);ui.setMode(mode);syncUI();}
function finish(win) {
  if(mode!=='playing')return;
  if(win)campaignResults[levelIndex]={kills:player.kills,total:enemies.length,elapsed,secretFound};
  mode=win?(levelIndex===CAMPAIGN.length-1?'win':'levelcomplete'):'dead';mouseHeld=false;touchFire=false;resetTouch();keys.clear();mapOpen=false;audio.play(win?'win':'death');audio.setActive(false);banter.stop();ui.clearBanter();
  if(document.pointerLockElement)document.exitPointerLock();syncUI();ui.setMode(mode,{...player,...levelData()});
  if(win)banter.play(mode==='win'?'finalWin':'levelClear',{level:levelIndex});
  if(mode==='win')try{const total=campaignTotals(campaignResults).elapsed,best=Number(localStorage.getItem('mushroom-doom-best'));if(!best||total<best)localStorage.setItem('mushroom-doom-best',String(Math.round(total)));}catch{}
}
function applySettings(settings) {
  audio.setVolume(Number(settings.volume));
  banter.setVolume(Number(settings.volume));banter.setEnabled(settings.voice!==false);
  if(!renderer)return;
  configureRendering();
}
function configureRendering() {
  bloom.enabled=!retroMode&&ui.settings.quality!=='low';renderer.shadowMap.enabled=!retroMode&&ui.settings.quality!=='low';
  retroPass.enabled=retroMode;renderer.domElement.style.imageRendering=retroMode?'pixelated':'auto';
  document.body.classList.toggle('retro-mode',retroMode);
  hemisphereLight.intensity=retroMode?2.2:1.6;sunLight.intensity=retroMode?1.55:3.2;rimLight.intensity=retroMode?.4:1.1;
  for(const root of [scene,weaponScene])root.traverse(object=>{
    if(!object.isMesh)return;
    for(const mat of(Array.isArray(object.material)?object.material:[object.material])){
      if(mat.bumpMap){if(!originalBumps.has(mat))originalBumps.set(mat,mat.bumpScale);mat.bumpScale=retroMode?0:originalBumps.get(mat);}
      for(const tex of[mat.map,mat.bumpMap])if(tex){
        if(!originalTextures.has(tex))originalTextures.set(tex,{min:tex.minFilter,mag:tex.magFilter,anisotropy:tex.anisotropy});
        const original=originalTextures.get(tex);tex.minFilter=retroMode?THREE.NearestFilter:original.min;tex.magFilter=retroMode?THREE.NearestFilter:original.mag;tex.anisotropy=retroMode?1:original.anisotropy;tex.needsUpdate=true;
      }
    }
  });
  resize();
}
function toggleRetro() {
  if(!renderer||mode==='loading')return;
  try{
    if(!retroSprites){retroSprites=createRetroSprites();for(const e of enemies){e.sprite=retroSprites.create(e.type);scene.add(e.sprite);}}
    retroMode=!retroMode;configureRendering();
    audio.play('key');notify(retroMode?'1993 CALLED. IT WANTS ITS KINGDOM BACK.':'BACK TO THE FUTURE · HD RESTORED');
    if(mode==='playing')banter.play('retro');
  }catch(error){console.error('Retro rendering could not be initialized',error);notify('THE TIME MACHINE NEEDS A TUNE-UP');}
}
function resize() {
  if(!renderer||!camera||!weaponCamera||!composer)return;
  const bounds=document.querySelector('#scene').getBoundingClientRect();
  const width=Math.max(1,Math.round(bounds.width)),height=Math.max(1,Math.round(bounds.height));
  camera.aspect=width/height;camera.updateProjectionMatrix();weaponCamera.aspect=camera.aspect;weaponCamera.updateProjectionMatrix();
  // Bound GPU work on dense phone displays and large monitors; HUD text stays native-resolution.
  const budget=matchMedia('(pointer:coarse)').matches?1500000:4000000;
  const ratio=retroMode?1:Math.min(devicePixelRatio||1,ui.settings.quality==='low'?1:1.5,Math.sqrt(budget/(width*height)));
  renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);
  const size=retroMode?retroResolution(width,height):{width,height};
  renderer.setSize(size.width,size.height,false);composer.setSize(size.width,size.height);retroPass?.uniforms.resolution.value.set(size.width,size.height);
}
function notify(text) {ui.toast(text);activeToastTime=3;}

function switchWeapon(index) {weaponIndex=index;recoil=.12;shotCooldown=Math.max(shotCooldown,.18);for(const[type,m]of Object.entries(weapons))m.visible=(type==='shotgun')===(index===0);syncUI();}
function lineClear(ax,az,bx,bz) {return !segmentBlocked(ax,az,bx,bz,world.colliders);}

function shoot() {
  if(mode!=='playing'||shotCooldown>0)return;
  const ammo=weaponIndex===0?'shells':'flowers';
  if(player[ammo]<=0){audio.play('empty');shotCooldown=.4;notify('OUT OF AMMO · FIND A SUPPLY CRATE');banter.play('empty');return;}
  player[ammo]--;shotCooldown=weaponIndex===0?.6:.23;recoil=1;muzzleTime=.065;
  audio.play(weaponIndex===0?'shotgun':'fireball');
  const forward=new THREE.Vector3();camera.getWorldDirection(forward);
  if(weaponIndex===0){
    const hits=new Map();
    for(let pellet=0;pellet<8;pellet++){
      const angle=aimYaw+(pellet-3.5)*.012+(Math.random()-.5)*.008;
      const dx=-Math.sin(angle),dz=-Math.cos(angle);let closest=null,near=40;
      for(const e of enemies){
        if(e.dead)continue;const ex=e.model.position.x-player.x,ez=e.model.position.z-player.z;
        const along=ex*dx+ez*dz,across=Math.abs(ex*dz-ez*dx);
        const bulletY=1.65+Math.tan(aimPitch)*along;
        if(along>0&&along<near&&across<e.radius+.08&&bulletY>-.2&&bulletY<e.height+.7&&lineClear(player.x,player.z,e.model.position.x,e.model.position.z)){closest=e;near=along;}
      }
      if(closest)hits.set(closest,(hits.get(closest)||0)+17*Math.max(.5,1-near/65));
    }
    for(const[e,amount]of hits)hurtEnemy(e,amount);
    if(!hits.size){const p=camera.position.clone().addScaledVector(forward,12);burst(p,5,'#edac59');}
  }else{
    spawnProjectile(new THREE.Vector3(player.x,1.5,player.z).addScaledVector(forward,.7),forward.multiplyScalar(27),true,48);
  }
  syncUI();
}

function burst(position,count,color='#ffb845') {
  const c=new THREE.Color(color);
  for(let i=0;i<count;i++){if(particles.length>=300)particles.shift();particles.push({x:position.x,y:position.y,z:position.z,vx:(Math.random()-.5)*7,vy:1+Math.random()*5,vz:(Math.random()-.5)*7,life:.3+Math.random()*.45,c});}
}
function hurtEnemy(e,amount) {
  if(e.dead)return;e.hp-=amount;e.awake=true;e.hurt=.15;
  ui.hit();audio.play('hit');burst(e.model.position.clone().add(new THREE.Vector3(0,e.height*.55,0)),8);
  if(e.hp<=0){
    e.dead=true;e.deadTime=.65;player.kills++;audio.play('enemy');
    burst(e.model.position.clone().add(new THREE.Vector3(0,e.height*.5,0)),e.type==='bowser'?65:22,'#ffdb6b');
    if(e.type==='bowser'){notify('BOWSER DEFEATED · THE WARP GATE IS OPEN');audio.play('key');banter.play('bossKill');}
    else banter.play(({goomba:'killGoomba',koopa:'killKoopa',boo:'killBoo'})[e.type]||'kill');
    // Enemies drop useful ammunition, rewarding aggressive play.
    if(player.kills%3===0){player.shells=Math.min(99,player.shells+4);player.flowers=Math.min(150,player.flowers+6);}
    syncUI();
  }
}
function hurtPlayer(amount) {
  if(mode!=='playing'||damageTime>0)return;
  const multiplier=difficulty==='easy'?.55:difficulty==='hard'?1.5:1;
  amount*=multiplier;const absorbed=Math.min(player.armor,amount*.65);player.armor-=absorbed;player.health=Math.max(0,player.health-(amount-absorbed));
  damageTime=.27;ui.damage();audio.play('hurt');if(player.health<35)banter.play('hurt');syncUI();if(player.health<=0)finish(false);
}
const projectileGeometry=new THREE.SphereGeometry(.18,10,8);
const projectileMaterials={friendly:new THREE.MeshBasicMaterial({color:'#ffdc71'}),enemy:new THREE.MeshBasicMaterial({color:'#ff6426'})};
function spawnProjectile(position,velocity,friendly,damage) {
  const mesh=new THREE.Mesh(projectileGeometry,projectileMaterials[friendly?'friendly':'enemy']);mesh.position.copy(position);if(!friendly)mesh.scale.setScalar(1.5);scene.add(mesh);
  projectiles.push({mesh,velocity,friendly,damage,life:4});
}
function updateProjectiles(dt) {
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i],pos=p.mesh.position,old=pos.clone();p.life-=dt;pos.addScaledVector(p.velocity,dt);
    let impact=p.life<=0||pos.y<.1||pos.y>12||segmentBlocked(old.x,old.z,pos.x,pos.z,world.colliders);
    if(!impact&&p.friendly){
      for(const e of enemies)if(!e.dead&&Math.hypot(pos.x-e.model.position.x,pos.z-e.model.position.z)<e.radius+.3&&pos.y<e.height+.3){
        hurtEnemy(e,p.damage);impact=true;
        for(const other of enemies)if(other!==e&&!other.dead&&other.model.position.distanceTo(pos)<2.8&&lineClear(pos.x,pos.z,other.model.position.x,other.model.position.z))hurtEnemy(other,p.damage*.5);
        break;
      }
    }else if(!impact&&!p.friendly&&Math.hypot(pos.x-player.x,pos.z-player.z)<.65&&pos.y<2){hurtPlayer(p.damage);impact=true;}
    if(impact){burst(pos,10,p.friendly?'#ffd760':'#f9782e');scene.remove(p.mesh);projectiles.splice(i,1);}
    else if(Math.random()<.5)burst(pos,1,p.friendly?'#f6b44e':'#c65d2d');
  }
}

function updateEnemies(dt,time) {
  for(const e of enemies){
    if(e.dead){if(e.deadTime>0){e.deadTime-=dt;e.model.scale.y=Math.max(.05,e.deadTime/.65);e.model.position.y=-.1*(1-e.deadTime/.65);e.shadow.material.opacity=Math.max(0,e.deadTime*.5);if(e.deadTime<=0){e.model.visible=false;e.shadow.visible=false;}}continue;}
    const pos=e.model.position,dx=player.x-pos.x,dz=player.z-pos.z,dist=Math.hypot(dx,dz);
    const clear=dist<30&&lineClear(pos.x,pos.z,player.x,player.z);
    if(clear&&dist<(e.type==='bowser'?26:23))e.awake=true;
    if(e.type==='bowser'&&e.awake&&!bossIntroduced){bossIntroduced=true;banter.play('bossIntro');}
    let moving=false;e.attack-=dt;e.hurt=Math.max(0,e.hurt-dt);
    if(e.awake){
      e.model.rotation.y=Math.atan2(dx,dz);
      if(dist>e.radius+.65){
        let tx=player.x,tz=player.z;
        // Route through the central castle gates when following between courts.
        const gates=world.navigationGates||(world.gates||[-7,-37]).map(z=>({x:0,z}));
        for(const gate of gates)if((pos.z-gate.z)*(player.z-gate.z)<0&&Math.abs(pos.x-gate.x)>2){tx=gate.x;tz=gate.z+(pos.z>gate.z?2.5:-2.5);break;}
        const vx=tx-pos.x,vz=tz-pos.z,len=Math.hypot(vx,vz)||1;
        const speed=enemyStats[e.type].speed*(difficulty==='hard'?1.2:1)*(e.hurt>0?.25:1);
        const before=pos.clone();
        moveCircle(pos,vx/len*speed*dt,vz/len*speed*dt,e.radius*.8,world.colliders);
        if(pos.distanceToSquared(before)<.00001)moveCircle(pos,-vz/len*speed*dt*e.turn,vx/len*speed*dt*e.turn,e.radius*.8,world.colliders);
        // Keep enemies from collapsing into one silhouette.
        for(const other of enemies)if(other!==e&&!other.dead){const ox=pos.x-other.model.position.x,oz=pos.z-other.model.position.z,d=Math.hypot(ox,oz);if(d>.01&&d<(e.radius+other.radius)*.8)moveCircle(pos,ox/d*dt*.7,oz/d*dt*.7,e.radius*.8,world.colliders);}
        moving=pos.distanceToSquared(before)>.000001;
      }
      if(dist<e.radius+.95&&e.attack<=0){hurtPlayer(enemyStats[e.type].damage);e.attack=e.type==='bowser'?.9:1.1;}
      else if(clear&&dist>3&&e.attack<=0&&['koopa','bowser'].includes(e.type)){
        const origin=pos.clone().add(new THREE.Vector3(0,e.type==='bowser'?2.55:1.35,0));
        const direction=new THREE.Vector3(player.x,1.2,player.z).sub(origin).normalize();
        spawnProjectile(origin.clone().addScaledVector(direction,e.radius+.35),direction.multiplyScalar(e.type==='bowser'?13:9),false,e.type==='bowser'?23:12);
        e.attack=e.type==='bowser'?1.25:2.8;audio.play('enemy');
      }
    }
    animateEnemy(e.model,e.type,time,moving,dt);e.shadow.position.x=pos.x;e.shadow.position.z=pos.z;
  }
}

function updatePlayer(dt) {
  const turn=(keys.has('ArrowLeft')?1:0)-(keys.has('ArrowRight')?1:0);aimYaw+=turn*dt*2;
  let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-stick.y;
  let side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+stick.x;
  let length=Math.hypot(forward,side);if(length>1){forward/=length;side/=length;length=1;}
  const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight')||stick.sprint;const speed=sprint?11.5:7.5;
  const dx=(-Math.sin(aimYaw)*forward+Math.cos(aimYaw)*side)*speed*dt;
  const dz=(-Math.cos(aimYaw)*forward-Math.sin(aimYaw)*side)*speed*dt;
  moveCircle(player,dx,dz,.35,world.colliders);
  for(const e of enemies)if(!e.dead){const ex=player.x-e.model.position.x,ez=player.z-e.model.position.z,dist=Math.hypot(ex,ez),limit=e.radius+.3;if(dist<limit&&dist>.001)moveCircle(player,ex/dist*(limit-dist),ez/dist*(limit-dist),.35,world.colliders);}
  bob+=dt*(length?(sprint?15:11):2);
  camera.position.set(player.x,1.65+(length?Math.sin(bob)*.038:Math.sin(bob)*.008),player.z);
  camera.rotation.set(aimPitch,aimYaw,0,'YXZ');
  const targetFov=sprint&&length?85:78;camera.fov+=(targetFov-camera.fov)*Math.min(1,dt*6);camera.updateProjectionMatrix();
  if(touchFire&&ui.settings.aimAssist)aimAssist(dt);
  if((mouseHeld||touchFire||keys.has('Space'))&&!mapOpen)shoot();
  for(const p of pickups){
    if(p.collected||Math.hypot(p.x-player.x,p.z-player.z)>1.15)continue;
    if(p.type==='health'&&player.health>=(difficulty==='easy'?150:100))continue;
    if(p.type==='armor'&&player.armor>=100)continue;
    p.collected=true;p.model.visible=false;ui.pickup();audio.play(p.type==='key'?'key':'pickup');
    if(p.type==='health'){player.health=Math.min(difficulty==='easy'?150:100,player.health+35);notify('+35 HEALTH · SUPER MUSHROOM');}
    if(p.type==='armor'){player.armor=Math.min(100,player.armor+50);notify('+50 ARMOR · KOOPA SHELL');}
    if(p.type==='ammo'){player.shells=Math.min(99,player.shells+12);player.flowers=Math.min(150,player.flowers+20);notify('+12 SHELLS · +20 FIRE FLOWERS');}
    if(p.type==='key'){player.key=true;notify(world.requiresBoss?'POWER STAR ACQUIRED · FIND BOWSER':'POWER STAR ACQUIRED · FIND THE WARP GATE');}
    banter.play(p.type);
    syncUI();
  }
  if(world.lavaZones?.some(l=>player.x>l.minX&&player.x<l.maxX&&player.z>l.minZ&&player.z<l.maxZ))hurtPlayer(9);
  const nextZone=Math.max(0,world.zones?.findIndex(zone=>player.z>=zone.minZ)??0);
  if(nextZone!==zoneIndex){zoneIndex=nextZone;notify(world.zones?.[zoneIndex]?.name||'NEW AREA');}
  const secret=world.secret||{x:-15,z:28,radius:2};
  if(!secretFound&&Math.hypot(player.x-secret.x,player.z-secret.z)<secret.radius){secretFound=true;player.armor=Math.min(100,player.armor+30);player.shells=Math.min(99,player.shells+8);notify('SECRET FOUND · THE PLUMBER’S STASH');audio.play('key');ui.pickup();banter.play('secret');}
}
function interact() {
  if(mode!=='playing')return;
  if(Math.hypot(player.x-world.exit.x,player.z-world.exit.z)>4){notify('FIND THE POWER STAR · REACH THE WARP GATE');return;}
  if(!player.key){notify('THE WARP GATE REQUIRES A POWER STAR');audio.play('empty');}
  else if(world.requiresBoss&&enemies.some(e=>e.type==='bowser'&&!e.dead)){notify('DEFEAT BOWSER TO OPEN THE WARP GATE');audio.play('empty');}
  else finish(true);
}

function syncUI() {
  if(!world)return;
  const boss=enemies.find(e=>e.type==='bowser');const bossNear=mode!=='menu'&&player.z<-35&&boss&&!boss.dead;
  const bossDefeated=!world.requiresBoss||!!boss?.dead;
  const nearExit=Math.hypot(player.x-world.exit.x,player.z-world.exit.z)<4;
  ui.update({health:Math.ceil(player.health),armor:Math.ceil(player.armor),ammo:weaponIndex===0?player.shells:player.flowers,reserve:weaponIndex===0?player.flowers:player.shells,
    key:player.key,keys:player.key?1:0,kills:player.kills,total:enemies.length,elapsed,time:elapsed,levelIndex,levelNumber:levelIndex+1,levelCount:CAMPAIGN.length,levelName:CAMPAIGN[levelIndex].name,
    weapon:weaponIndex===0?'shotgun':'fireflower',weaponName:weaponIndex===0?'SUPER SHOTGUN':'FIRE FLOWER',
    zone:world.zones?.[zoneIndex]?.name||'THE ASHEN COURTYARD',
    objective:nearExit?(player.key&&bossDefeated?(levelIndex<2?'Press E · Travel to the next level':'Press E · Finish the campaign'):!player.key?'Warp gate sealed · Find the Power Star':'Warp gate sealed · Defeat Bowser'):!player.key?'Find this level’s Power Star':bossDefeated?'Reach the green warp gate · Press E':'Enter the citadel. Defeat Bowser.',
    bossHealth:bossNear?Math.max(0,boss.hp):null,bossMax:boss?.maxHp||1150,mapOpen,mode,secretFound});
}

function drawMap() {
  const canvas=document.querySelector('#map-canvas');if(!canvas)return;
  const w=430,h=600;canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');
  c.fillStyle='#0c150e';c.fillRect(0,0,w,h);c.fillStyle='#d5c49b';c.font='12px monospace';c.fillText(`${levelIndex+1} / ${CAMPAIGN[levelIndex].name}`,24,32);c.fillStyle='#7f9575';c.font='9px monospace';c.fillText('TAB TO CLOSE     ▲ YOU     ★ POWER STAR',24,53);
  const scale=4.65,ox=w/2,oz=160;const x=v=>ox+v*scale,z=v=>oz+(v+65)*scale;
  // Map is oriented north-up, with the entire authored level visible.
  const zz=v=>85+(v+65)*4.8;
  c.strokeStyle='#647753';c.strokeRect(x(-23),zz(-65),46*scale,97*4.8);
  c.fillStyle='#536347';for(const r of world.colliders)c.fillRect(x(r.minX),zz(r.minZ),(r.maxX-r.minX)*scale,(r.maxZ-r.minZ)*4.8);
  c.fillStyle='#9db97b';c.font='9px monospace';c.fillText('EXIT',x(-20),zz(-60));c.fillText('START',x(-20),zz(29));
  for(const p of pickups)if(!p.collected){c.fillStyle=p.type==='key'?'#ffe074':'#8cc9b2';c.fillRect(x(p.x)-2,zz(p.z)-2,4,4);}
  for(const e of enemies)if(!e.dead){c.fillStyle=e.type==='bowser'?'#ff8d40':'#c65c3e';c.beginPath();c.arc(x(e.model.position.x),zz(e.model.position.z),e.type==='bowser'?5:2.5,0,7);c.fill();}
  c.strokeStyle='#8df4b5';c.strokeRect(x(-2),zz(-62),4*scale,3*4.8);
  c.save();c.translate(x(player.x),zz(player.z));c.rotate(-aimYaw);c.fillStyle='#fff0c3';c.beginPath();c.moveTo(0,-8);c.lineTo(5,5);c.lineTo(0,3);c.lineTo(-5,5);c.closePath();c.fill();c.restore();
}

function frame(timestamp) {
  requestAnimationFrame(frame);const dt=Math.min((timestamp-lastTime)/1000||.016,.035);lastTime=timestamp;ambientTime+=dt;
  world.update(dt,ambientTime);
  for(const p of pickups)if(!p.collected){p.model.rotation.y=ambientTime*.85+p.phase;p.model.position.y=.22+Math.sin(ambientTime*2+p.phase)*.13;}
  if(mode==='playing'){
    elapsed+=dt;shotCooldown=Math.max(0,shotCooldown-dt);damageTime=Math.max(0,damageTime-dt);activeToastTime-=dt;
    updatePlayer(dt);if(mode==='playing'){updateEnemies(dt,ambientTime);updateProjectiles(dt);}
    audio.update(dt);uiTick+=dt;if(uiTick>.1){syncUI();uiTick=0;}
    if(mapOpen)drawMap();
  }else if(mode==='menu'){
    camera.fov=62;camera.updateProjectionMatrix();camera.position.set(11+Math.sin(ambientTime*.07)*1.3,5.4+Math.sin(ambientTime*.1)*.2,25);camera.lookAt(-1,3,-10);
    enemies.forEach(e=>{if(!e.dead)animateEnemy(e.model,e.type,ambientTime,false,dt);});
  }
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=10*dt;}
  const positions=particleGeometry.attributes.position,colors=particleGeometry.attributes.color;
  particles.forEach((p,i)=>{positions.setXYZ(i,p.x,p.y,p.z);colors.setXYZ(i,p.c.r,p.c.g,p.c.b);});
  positions.needsUpdate=true;colors.needsUpdate=true;particleGeometry.setDrawRange(0,particles.length);
  for(const e of enemies){
    e.model.visible=!retroMode&&(!e.dead||e.deadTime>0);e.shadow.visible=!retroMode&&(!e.dead||e.deadTime>0);
    if(e.sprite){e.sprite.visible=retroMode&&(!e.dead||e.deadTime>0);if(e.sprite.visible)retroSprites.update(e.sprite,e.type,e.model,camera,ambientTime);}
  }
  weaponPass.enabled=!['menu','loading','briefing'].includes(mode);
  if(weaponPass.enabled){
    recoil*=Math.exp(-dt*12);muzzleTime=Math.max(0,muzzleTime-dt);
    const active=weapons[weaponIndex===0?'shotgun':'fireflower'];
    active.position.set(.26+Math.sin(bob*.5)*.008,-.34+Math.cos(bob)*.006-recoil*.025,-.64+recoil*.1);
    active.rotation.set(recoil*.12,0,-recoil*.03);
    active.updateMatrixWorld();muzzle.position.copy(active.userData.muzzle).applyMatrix4(active.matrixWorld);muzzle.visible=muzzleTime>0;muzzle.material.rotation=Math.random()*6;
    muzzleLight.position.copy(muzzle.position);muzzleLight.intensity=muzzleTime>0?9:0;
  }
  if(retroPass.enabled)retroPass.uniforms.time.value=ambientTime;
  renderer.info.reset();composer.render();
}

function screenChanged(){touchFire=false;resetTouch();resize();}
window.addEventListener('resize',screenChanged);
window.visualViewport?.addEventListener('resize',screenChanged);
screen.orientation?.addEventListener('change',screenChanged);
matchMedia('(pointer:coarse)').addEventListener('change',screenChanged);
// Moving between monitors can change pixel density without changing CSS dimensions.
function watchPixelDensity(){
  matchMedia('(resolution: '+devicePixelRatio+'dppx)').addEventListener('change',()=>{screenChanged();watchPixelDensity();},{once:true});
}
watchPixelDensity();
document.addEventListener('keydown',e=>{
  if(e.code==='F4'&&!e.altKey&&!e.ctrlKey&&!e.metaKey){e.preventDefault();if(!e.repeat)toggleRetro();return;}
  if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
  if(mode==='playing'&&['Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.code==='Escape'){if(mode==='playing')pauseGame();else if(mode==='paused')resumeGame();return;}
  if(mode!=='playing')return;
  keys.add(e.code);
  if(!e.repeat){if(e.code==='Digit1')switchWeapon(0);if(e.code==='Digit2')switchWeapon(1);if(e.code==='KeyE')interact();if(e.code==='Tab'){mapOpen=!mapOpen;syncUI();}}
});
document.addEventListener('keyup',e=>keys.delete(e.code));
document.addEventListener('mousemove',e=>{
  if(mode!=='playing'||(!document.pointerLockElement&&!mouseHeld))return;
  aimYaw-=e.movementX*.0022*Number(ui.settings.sensitivity);aimPitch=THREE.MathUtils.clamp(aimPitch-e.movementY*.0022*Number(ui.settings.sensitivity),-1.05,1.05);
});
let lastTouchTime=-Infinity;document.addEventListener('touchstart',()=>{lastTouchTime=performance.now();},{passive:true,capture:true});
document.addEventListener('mousedown',e=>{if(performance.now()-lastTouchTime<1000)return;if(mode==='playing'&&e.button===0&&e.target===renderer.domElement){mouseHeld=true;if(!document.pointerLockElement)requestLock();}});
document.addEventListener('mouseup',()=>{mouseHeld=false;});
document.addEventListener('contextmenu',e=>{if(mode==='playing')e.preventDefault();});
document.addEventListener('pointerlockchange',()=>{const locked=!!document.pointerLockElement;if(wasLocked&&!locked&&mode==='playing')pauseGame();wasLocked=locked;});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
window.addEventListener('blur',()=>{keys.clear();mouseHeld=false;touchFire=false;resetTouch();if(mode==='playing')pauseGame();});
// Touch controls: a floating analog stick on the left, a look pad on the right (the FIRE button also aims while held).
const stick={id:null,ox:0,oy:0,x:0,y:0,sprint:false};const STICK_RADIUS=55;const lookTouches=new Map();
const stickEl=()=>document.getElementById('touch-stick'),knobEl=()=>document.getElementById('touch-knob');
function touchLookBy(dx,dy){
  if(mode!=='playing')return;const s=.0055*Number(ui.settings.sensitivity);
  aimYaw-=dx*s;aimPitch=THREE.MathUtils.clamp(aimPitch-dy*s*.8,-1.05,1.05);
}
function drawStick(){
  const base=stickEl(),knob=knobEl();if(!base||!knob)return;
  base.classList.toggle('idle',stick.id===null);base.classList.toggle('sprint',stick.sprint);
  if(stick.id===null){base.style.left=base.style.top='';knob.style.transform='';return;}
  base.style.left=stick.ox+'px';base.style.top=stick.oy+'px';
  knob.style.transform=`translate(${stick.x*STICK_RADIUS}px,${stick.y*STICK_RADIUS}px)`;
}
function resetTouch(){stick.id=null;stick.x=stick.y=0;stick.sprint=false;lookTouches.clear();drawStick();}
function setStick(cx,cy){
  let dx=(cx-stick.ox)/STICK_RADIUS,dy=(cy-stick.oy)/STICK_RADIUS;const m=Math.hypot(dx,dy);
  // Let the base trail the thumb when it overshoots, so it never feels pinned.
  if(m>1.35){stick.ox+=dx/m*(m-1.35)*STICK_RADIUS;stick.oy+=dy/m*(m-1.35)*STICK_RADIUS;dx*=1.35/m;dy*=1.35/m;}
  const mag=Math.min(1,Math.hypot(dx,dy)),dead=.12,scaled=mag<dead?0:(mag-dead)/(1-dead);
  const len=Math.hypot(dx,dy)||1;stick.x=dx/len*scaled;stick.y=dy/len*scaled;
  stick.sprint=Math.hypot(dx,dy)>1.15&&stick.y<-.5;drawStick();
}
function aimAssist(dt){
  // Gentle pull toward the nearest visible enemy close to the crosshair. Only active while holding touch FIRE.
  let best=null,bestDiff=.16;
  for(const e of enemies){
    if(e.dead)continue;const ex=e.model.position.x-player.x,ez=e.model.position.z-player.z,dist=Math.hypot(ex,ez);
    if(dist>32||dist<.5)continue;
    const diff=Math.atan2(Math.sin(Math.atan2(-ex,-ez)-aimYaw),Math.cos(Math.atan2(-ex,-ez)-aimYaw));
    if(Math.abs(diff)<bestDiff&&lineClear(player.x,player.z,e.model.position.x,e.model.position.z)){best=diff;bestDiff=Math.abs(diff);}
  }
  if(best!==null)aimYaw+=best*Math.min(1,dt*5);
}
const canvasTouch=e=>e.pointerType==='touch'&&e.target===renderer?.domElement;
document.addEventListener('pointerdown',e=>{
  if(!canvasTouch(e)||mode!=='playing')return;
  if(e.clientX<innerWidth*.42&&stick.id===null){stick.id=e.pointerId;stick.ox=e.clientX;stick.oy=e.clientY;setStick(e.clientX,e.clientY);}
  else lookTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
});
document.addEventListener('pointermove',e=>{
  if(e.pointerType!=='touch'||mode!=='playing')return;
  if(e.pointerId===stick.id){e.preventDefault();setStick(e.clientX,e.clientY);return;}
  const look=lookTouches.get(e.pointerId);if(!look)return;e.preventDefault();
  touchLookBy(e.clientX-look.x,e.clientY-look.y);look.x=e.clientX;look.y=e.clientY;
},{passive:false});
for(const type of['pointerup','pointercancel'])document.addEventListener(type,e=>{
  if(e.pointerType!=='touch')return;
  if(e.pointerId===stick.id){stick.id=null;stick.x=stick.y=0;stick.sprint=false;drawStick();}
  lookTouches.delete(e.pointerId);
});

// A read-only snapshot supports repeatable smoke checks and performance diagnostics.
window.gameSnapshot=()=>({mode,level:levelIndex+1,levelName:CAMPAIGN[levelIndex].name,levelCount:CAMPAIGN.length,campaignResults:campaignResults.map(r=>({...r})),exit:world?{...world.exit}:null,navigationGates:world?.navigationGates||[],player:{...player},aim:{yaw:aimYaw,pitch:aimPitch},enemies:enemies.map(e=>({type:e.type,x:e.model.position.x,z:e.model.position.z,hp:e.hp,dead:e.dead})),pickups:pickups.map(p=>({type:p.type,x:p.x,z:p.z,collected:p.collected})),elapsed,weapon:weaponIndex,mapOpen,secretFound,graphics:retroMode?'1993':'hd',framebuffer:renderer?{width:renderer.domElement.width,height:renderer.domElement.height}:null,drawCalls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles});
try{init();}catch(error){console.error(error);document.querySelector('#loading').innerHTML='<div class="error-msg"><h2>Unable to start the renderer</h2><p>This game needs WebGL 2. Try a current browser with hardware acceleration enabled, then reload.</p></div>';}
