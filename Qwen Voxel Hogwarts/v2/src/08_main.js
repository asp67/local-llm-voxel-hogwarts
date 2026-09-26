/* ===== 08_main.js — camera, controls, pipeline, loop ===== */

const S0=makeScene();
const {renderer,scene,mats,moonLight,moonGrp,cloudGrp}=S0;
const DEF={yaw:0.62,pitch:0.6155,dist:330,tx:CX+4,ty:PLAT_Y-4,tz:CZ+4};
const view={target:new THREE.Vector3(DEF.tx,DEF.ty,DEF.tz),yaw:DEF.yaw,pitch:DEF.pitch,
            dist:DEF.dist,distGoal:DEF.dist,ortho:true,autoOrbit:false};
const keys={};
let camPersp=new THREE.PerspectiveCamera(45,1,0.5,4000);
let camOrtho=new THREE.OrthographicCamera(-1,1,1,-1,-2000,4000);
let camera=camOrtho;

function curCam(){ return view.ortho?camOrtho:camPersp; }
function dir3(){ const cp=Math.cos(view.pitch);
  return new THREE.Vector3(Math.sin(view.yaw)*cp,Math.sin(view.pitch),Math.cos(view.yaw)*cp); }
function updateCamera(){
  view.dist+=(view.distGoal-view.dist)*0.25;
  const d=dir3();
  if(view.ortho){
    camOrtho.position.copy(view.target).addScaledVector(d,1500);
    const hh=view.dist*0.42, aspect=renderer.domElement.width/Math.max(1,renderer.domElement.height);
    camOrtho.top=hh; camOrtho.bottom=-hh; camOrtho.left=-hh*aspect; camOrtho.right=hh*aspect;
    camOrtho.lookAt(view.target); camOrtho.updateProjectionMatrix();
    camera=camOrtho;
  }else{
    camPersp.position.copy(view.target).addScaledVector(d,view.dist);
    camPersp.lookAt(view.target);
    camera=camPersp;
  }
}
function clampTarget(){
  view.target.set(
    clampf(view.target.x,CX-190,CX+190),
    clampf(view.target.y,LAKE_Y-70,PLAT_Y+120),
    clampf(view.target.z,CZ-190,CZ+190));
}
function clampf(v,a,b){return Math.max(a,Math.min(b,v));}

const canvas=renderer.domElement;
function resize(){
  const w=innerWidth,h=innerHeight;
  canvas.style.width=w+'px'; canvas.style.height=h+'px';
  renderer.setSize(Math.floor(w),Math.floor(h),false);
  const aspect=w/Math.max(1,h);
  camPersp.aspect=aspect; camPersp.updateProjectionMatrix();
  if(!composerReady) S0.makeComposer(w,h), composerReady=true;
  else { const b=S0.getComposer().passes[1]; if(b&&b.setSize) b.setSize(w,h); }
  S0.getComposer().setSize(w,h);
}
let composerReady=false;
addEventListener('resize',resize);

/* ---- input ---- */
addEventListener('keydown',e=>{
  keys[e.code]=true;
  const setD=g=>{view.distGoal=clampf(g,6,900);};
  if(e.code==='Minus'||e.code==='NumpadSubtract'||e.code==='KeyX') setD(view.distGoal/1.15);
  if(e.code==='Equal'||e.code==='NumpadAdd'||e.code==='KeyZ'||e.code==='BracketLeft') setD(view.distGoal*1.15);
  if(e.code==='BracketRight') setD(view.distGoal/1.15);
  if(e.code==='PageUp') setD(view.distGoal*1.2);
  if(e.code==='PageDown') setD(view.distGoal/1.2);
  if(e.code==='Digit0'||e.code==='Home'){ view.yaw=DEF.yaw;view.pitch=DEF.pitch;view.distGoal=DEF.dist;
    view.target.set(DEF.tx,DEF.ty,DEF.tz); }
  if(e.code==='KeyP'){ view.ortho=!view.ortho; if(!view.ortho)view.distGoal=clampf(view.dist,6,900); }
  if(e.code==='KeyT') view.autoOrbit=!view.autoOrbit;
  if(e.code==='KeyH'){ const hp=document.getElementById('help');
    hp.style.display=hp.style.display==='none'?'block':'none'; }
  if(e.code==='Space'||e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup',e=>{keys[e.code]=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
let dragMode=0,lastX=0,lastY=0;
const pointers=new Map();
canvas.addEventListener('pointerdown',e=>{
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){ dragMode=3; }
  else dragMode=(e.button===2||e.button===1||e.shiftKey)?2:1;
  lastX=e.clientX; lastY=e.clientY;
  canvas.classList.add('dragging'); canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(pointers.size<2)dragMode=0;canvas.classList.remove('dragging');});
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(dragMode===3){                       // 2-finger pinch + pan
    const arr=[...pointers.values()];
    const d=Math.hypot(arr[0].x-arr[1].x,arr[0].y-arr[1].y);
    if(lastPinch){ view.distGoal=clampf(view.distGoal*lastPinch/d,6,900); }
    lastPinch=d; return;
  }
  if(!dragMode)return;
  let dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
  if(dragMode===1){ view.yaw-=dx*0.005; view.pitch=clampf(view.pitch+dy*0.004,0.03,1.5); }
  else{
    const s=view.dist*0.0013+0.2;
    const right=new THREE.Vector3().setFromMatrixColumn(curCam().matrixWorld,0);
    const up=new THREE.Vector3().setFromMatrixColumn(curCam().matrixWorld,1);
    view.target.addScaledVector(right,-dx*s).addScaledVector(up,dy*s);
    clampTarget();
  }
});
let lastPinch=0;
canvas.addEventListener('pointerleave',()=>{lastPinch=0;});
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  view.distGoal=clampf(view.distGoal*Math.exp(e.deltaY*0.0011),6,900);
},{passive:false});

function applyKeys(dt){
  const sprint=(keys['ShiftLeft']||keys['ShiftRight'])?3:1;
  const speed=Math.max(12,view.dist*0.75)*sprint*dt;
  const yaw=view.yaw;
  const fwdH=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const rightH=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const mv=new THREE.Vector3();
  const dF=dir3();
  // W/S: horizontal in isometric, along the view ray (fly) in perspective
  if(keys['KeyW']) mv.add(view.ortho?fwdH:dF);
  if(keys['KeyS']) mv.sub(view.ortho?fwdH:dF);
  if(keys['KeyD']) mv.add(rightH);
  if(keys['KeyA']) mv.sub(rightH);
  mv.y+=(keys['KeyR']||keys['Space']?1:0);
  mv.y-=(keys['KeyF']||keys['KeyC']?1:0);
  if(mv.lengthSq()>0){ mv.normalize(); view.target.addScaledVector(mv,speed); clampTarget(); }
  if(keys['KeyQ']||keys['ArrowLeft']) view.yaw-=1.5*dt;
  if(keys['KeyE']||keys['ArrowRight']) view.yaw+=1.5*dt;
  if(keys['ArrowUp']) view.pitch=clampf(view.pitch+1.1*dt,0.03,1.5);
  if(keys['ArrowDown']) view.pitch=clampf(view.pitch-1.1*dt,0.03,1.5);
}

/* ---- build pipeline ---- */
const msgEl=document.getElementById('loadmsg'), barEl=document.getElementById('loadbar');
function step(msg,p){ msgEl.textContent=msg; barEl.style.width=(p*100)+'%';
  return new Promise(r=>setTimeout(r,0)); }

let pointLights=[];
async function main(){
  try{
    await step('carving the floating island…',0.05);
    buildTerrain();
    await step('raising Hogwarts stone by stone…',0.15);
    buildCastle();
    await step('planting the Forbidden Forest…',0.25);
    buildGrounds();
    await step('counting every cube…',0.32);
    S0.makeComposer(innerWidth,innerHeight); composerReady=true; resize();
    let tris=0;
    await new Promise(res=>buildChunkMeshes(scene,mats,
      p=>{barEl.style.width=(32+p*58)+'%';},
      t=>{tris=t;res();}));
    await step('lighting a thousand candles…',0.94);
    addPointLights();
    barEl.style.width='100%';
    await step('the castle sleeps.',1);
    window.hogwarts={view,scene,get:(x,y,z)=>get(x,y,z),PAL,grid,renderer,S0};
    // stats
    const statsEl=document.getElementById('stats');
    let acc=0,frames=0,shown=0;
    const startT=performance.now();
    function loop(t){
      const now=t/1000, dt=Math.min(0.06,(t-(loop.last||t))/1000); loop.last=t;
      applyKeys(dt);
      if(view.autoOrbit) view.yaw+=dt*0.08;
      updateCamera();
      const cam=curCam();
      const halfH=view.ortho?view.dist*0.42:(view.dist*Math.tan(camPersp.fov*Math.PI/360));
      placeMoon(moonGrp,cam,halfH||150,innerWidth/Math.max(1,innerHeight),view.ortho,view.target);
      // cloud drift
      cloudGrp.rotation.y+=dt*0.006;
      cloudGrp.userData.mesh.position.y=Math.sin(now*0.3)*1.2;
      // flicker
      const fl=1+Math.sin(now*4.3)*0.05+Math.sin(now*11.7)*0.035;
      for(const L of pointLights) L.intensity=L.userData.b*fl;
      S0.updateCar(now,dt);
      S0.setCameraForPass(cam);
      S0.getComposer().render();
      acc+=dt;frames++;
      if(acc>0.5){ shown=Math.round(frames/acc); acc=0;frames=0;
        statsEl.textContent=tris.toLocaleString()+' tris · '+shown+' fps · '+(view.ortho?'iso':'fly'); }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    const L=document.getElementById('loader');
    L.style.opacity='0'; setTimeout(()=>L.style.display='none',900);
  }catch(e){
    console.error(e);
    document.getElementById('errmsg').textContent='Build failed: '+e.message;
    document.getElementById('errhint').textContent=String(e.stack||'').split('\n').slice(0,3).join('\n');
    document.getElementById('err').style.display='flex';
  }
}
function addPointLights(){
  for(const c of castleLights){
    const L=new THREE.PointLight(0xffa24d, 38*c.i, 44, 1.3);
    L.position.set(c.x,c.y,c.z); L.userData.b=38*c.i;
    scene.add(L); pointLights.push(L);
    if(pointLights.length>=14) break;
  }
}
main();
