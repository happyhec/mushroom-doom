// Run this function using Playwright's browser_run_code_unsafe filename option.
// All actions are input events; gameSnapshot is used only for observation.
async (page) => {
  await page.evaluate(() => {
    window.smokeRoutes = [
      [{x:2,z:20},{x:0,z:8},{x:0,z:-4},{x:0,z:-12},{x:0,z:-30},{x:0,z:-40},{x:0,z:-50},{x:0,z:-60}],
      [{x:-11,z:18},{x:-11,z:-12},{x:-6,z:-15},{x:-6,z:-30},{x:15,z:-26},{x:11,z:-33},{x:11,z:-41},{x:0,z:-43},{x:0,z:-60}],
      [{x:0,z:-12},{x:-7,z:-16},{x:-13,z:-23},{x:-7,z:-30},{x:0,z:-40},{x:0,z:-49},{x:0,z:-60}],
    ];
    window.smokeIndex = 0;
    const key = (code, down) => document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', {code, bubbles:true}));
    window.smokeStep = () => {
      const s = window.gameSnapshot(); if (s.mode !== 'playing') return;
      const route = window.smokeRoutes[s.level - 1], target = route[window.smokeIndex], p = s.player;
      const zone = z => z < -37 ? 2 : z < -7 ? 1 : 0;
      const enemies = s.enemies.filter(e => !e.dead && Math.hypot(e.x-p.x,e.z-p.z)<25 && (zone(e.z)===zone(p.z)||Math.abs(e.x-(s.navigationGates.find(g=>Math.abs(g.z-e.z)<15)?.x||0))<3)).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
      const e=enemies[0], aim=e||target, dx=aim.x-p.x, dz=aim.z-p.z, yaw=Math.atan2(-dx,-dz);
      const pitch=e?Math.atan2((e.type==='bowser'?2:e.type==='goomba'?.9:1.2)-1.65,Math.hypot(dx,dz)):0;
      document.querySelector('#scene canvas').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));
      document.dispatchEvent(new MouseEvent('mousemove',{movementX:(s.aim.yaw-yaw)/.0022,movementY:(s.aim.pitch-pitch)/.0022}));
      document.dispatchEvent(new MouseEvent('mouseup'));
      key('Space',!!e);
      for(const code of ['KeyW','KeyA','KeyS','KeyD'])key(code,false);
      const vx=target.x-p.x,vz=target.z-p.z,dist=Math.hypot(vx,vz);
      if(dist<1)window.smokeIndex=Math.min(window.smokeIndex+1,route.length-1);
      else {
        const f=(-vx*Math.sin(yaw)-vz*Math.cos(yaw))/dist,side=(vx*Math.cos(yaw)-vz*Math.sin(yaw))/dist;
        if(!e||Math.hypot(e.x-p.x,e.z-p.z)>=3){for(const[code,down]of[['KeyW',f>.3],['KeyS',f<-.3],['KeyD',side>.3],['KeyA',side<-.3]])if(down)key(code,true);}
      }
      if(p.shells===0)key('Digit2',true);
      if(Math.hypot(p.x-s.exit.x,p.z-s.exit.z)<3.2)key('KeyE',true);
    };
    window.smokeRun = async (steps=180) => {
      for(let i=0;i<steps;i++){window.smokeStep();await new Promise(r=>setTimeout(r,100));if(window.gameSnapshot().mode!=='playing')break;}
      for(const code of ['KeyW','KeyA','KeyS','KeyD','Space'])key(code,false);
      if(window.gameSnapshot().mode==='playing')key('Escape',true);
      const s=window.gameSnapshot();return {mode:s.mode,level:s.level,route:window.smokeIndex,player:s.player,graphics:s.graphics,results:s.campaignResults};
    };
  });
  return {installed:true};
}
