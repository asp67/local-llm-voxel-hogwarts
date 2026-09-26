/* ===== 07_scene.js — renderer, sky, lights, clouds, stars, moon, car, bloom ===== */
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const MOON_SKY=(function(){
  // 8° above horizon, 45° left of the default view's back direction (yaw 0.62)
  const backYaw=0.62+Math.PI;
  const a=backYaw-Math.PI/4*0;                 // 45° left of "back"
  const yaw=backYaw+Math.PI/4;
  const v=new THREE.Vector3(Math.sin(yaw)*Math.cos(8*Math.PI/180),
                            Math.sin(8*Math.PI/180),
                            Math.cos(yaw)*Math.cos(8*Math.PI/180));
  return v.normalize();
})();

function makeScene(){
  const canvas=document.getElementById('scene');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  renderer.setClearColor(0x050817,1);

  const scene=new THREE.Scene();

  /* vertical gradient sky */
  {
    const c=document.createElement('canvas'); c.width=4;c.height=256;
    const g=c.getContext('2d'); const lg=g.createLinearGradient(0,0,0,256);
    lg.addColorStop(0,'#050817'); lg.addColorStop(0.45,'#0b1336');
    lg.addColorStop(0.75,'#15215a'); lg.addColorStop(1,'#1c2a6a');
    g.fillStyle=lg; g.fillRect(0,0,4,256);
    const tex=new THREE.CanvasTexture(c);
    tex.colorSpace=THREE.SRGBColorSpace;
    scene.background=tex;
  }

  /* lights */
  scene.add(new THREE.HemisphereLight(0x5a6cc0,0x1a1522,1.1));
  scene.add(new THREE.AmbientLight(0x202848,0.9));
  const moonLight=new THREE.DirectionalLight(0xb4c4ff,2.6);
  // steep light from the moon's compass direction so shadows stay short (Section 11)
  const md=new THREE.Vector3(MOON_SKY.x*0.6,1,MOON_SKY.z*0.6).normalize();
  moonLight.position.copy(md.clone().multiplyScalar(450).add(new THREE.Vector3(CX,0,CZ)));
  moonLight.target.position.set(CX,PLAT_Y,CZ);
  moonLight.castShadow=true;
  moonLight.shadow.mapSize.set(4096,4096);
  const sc=moonLight.shadow.camera;
  sc.left=-200;sc.right=-0+200;sc.top=200;sc.bottom=-200;sc.near=10;sc.far=900;
  moonLight.shadow.bias=-0.0004; moonLight.shadow.normalBias=0.35; moonLight.shadow.radius=3;
  scene.add(moonLight); scene.add(moonLight.target);

  /* materials for the four kinds */
  const mats=[
    new THREE.MeshLambertMaterial({vertexColors:true}),
    new THREE.MeshBasicMaterial({vertexColors:true,color:new THREE.Color(1.9,1.9,1.9),toneMapped:false}),
    new THREE.MeshPhongMaterial({vertexColors:true,transparent:true,opacity:0.8,shininess:90,
      specular:new THREE.Color(0x5c74b8),depthWrite:false}),
    new THREE.MeshPhongMaterial({vertexColors:true,transparent:true,opacity:0.5,shininess:40,
      emissive:new THREE.Color(0x0c221a),depthWrite:false}),
  ];

  /* stars */
  {
    const n=2200, sp=new Float32Array(n*3);
    const r=mulberry32(4242);
    for(let i=0;i<n;i++){
      const a=r()*Math.PI*2, e=Math.acos(r()*0.96);
      const rr=1800;
      sp[i*3]=CX+Math.sin(e)*Math.cos(a)*rr;
      sp[i*3+1]=LAKE_Y+Math.cos(e)*rr*0.9+60;
      sp[i*3+2]=CZ+Math.sin(e)*Math.sin(a)*rr;
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(sp,3));
    scene.add(new THREE.Points(g,new THREE.PointsMaterial({color:0xaab6d8,size:1.6,sizeAttenuation:false,fog:false})));
  }

  /* voxel moon (placed each frame like a skybox object) */
  const moonGrp=new THREE.Group();
  {
    const cells=[]; const rM=6;
    for(let x=-rM;x<=rM;x++)for(let y=-rM;y<=rM;y++)for(let z=-rM;z<=rM;z++)
      if(x*x+y*y+z*z<=rM*rM) cells.push([x*3,y*3,z*3]);
    const B=makeBuf();
    for(const [cx,cy,cz] of cells){
      for(let fi=0;fi<6;fi++){
        const f=FACES[fi], n=f.n;
        const nx=cx+n[0]*3,ny=cy+n[1]*3,nz=cz+n[2]*3;
        if(cells.some(c=>c[0]===nx&&c[1]===ny&&c[2]===nz)) continue;
        const base=B.vertCount(); B.ensure(4);
        for(const [du,dv] of [[0,0],[1,0],[1,1],[0,1]]){
          B.pos[B.np++]=cx+n[0]*3+f.u[0]*3*du+f.v[0]*3*dv;
          B.pos[B.np++]=cy+n[1]*3+f.u[1]*3*du+f.v[1]*3*dv;
          B.pos[B.np++]=cz+n[2]*3+f.u[2]*3*du+f.v[2]*3*dv;
          B.nor[B.nn++]=n[0]*127;B.nor[B.nn++]=n[1]*127;B.nor[B.nn++]=n[2]*127;
          const q=0.9+hash(cx,cy,cz)*0.1;
          B.col[B.nc++]=Math.round(230*q*257);B.col[B.nc++]=Math.round(236*q*257);B.col[B.nc++]=Math.round(255*q*257);
        }
        B.idx[B.ni++]=base;B.idx[B.ni++]=base+1;B.idx[B.ni++]=base+2;
        B.idx[B.ni++]=base;B.idx[B.ni++]=base+2;B.idx[B.ni++]=base+3;
      }
    }
    const mesh=new THREE.Mesh(B.toGeometry(),
      new THREE.MeshBasicMaterial({vertexColors:true,color:new THREE.Color(1.55,1.55,1.75),toneMapped:false,fog:false}));
    moonGrp.add(mesh);
    scene.add(moonGrp);
  }

  /* voxel clouds */
  const cloudGrp=new THREE.Group();
  {
    const cloudMat=new THREE.MeshLambertMaterial({color:0x93a0c4,emissive:0x141a34,
      transparent:true,opacity:0.55,depthWrite:false});
    const rC=mulberry32(31337);
    const B=makeBuf();
    function ellipsoid(cx2,cy2,cz2,rx,ry,rz,cell){
      const sx=Math.ceil(rx/cell)+1, sy=Math.ceil(ry/cell)+1, sz=Math.ceil(rz/cell)+1;
      const filled=(x,y,z)=>((x*cell)/rx)**2+((y*cell)/ry)**2+((z*cell)/rz)**2<=1;
      for(let x=-sx;x<=sx;x++)for(let y=-sy;y<=sy;y++)for(let z=-sz;z<=sz;z++){
        if(!filled(x,y,z)) continue;
        for(let fi=0;fi<6;fi++){
          const f=FACES[fi], n=f.n;
          if(filled(x+n[0],y+n[1],z+n[2])) continue;
          const base=B.vertCount(); B.ensure(4);
          for(const [du,dv] of [[0,0],[1,0],[1,1],[0,1]]){
            // same plane rule as the chunk mesher: +faces at cell+1, −faces at cell
            B.pos[B.np++]=cx2+(x+(n[0]>0?1:0))*cell + (f.u[0]*du+f.v[0]*dv)*cell;
            B.pos[B.np++]=cy2+(y+(n[1]>0?1:0))*cell + (f.u[1]*du+f.v[1]*dv)*cell;
            B.pos[B.np++]=cz2+(z+(n[2]>0?1:0))*cell + (f.u[2]*du+f.v[2]*dv)*cell;
            B.nor[B.nn++]=n[0]*127;B.nor[B.nn++]=n[1]*127;B.nor[B.nn++]=n[2]*127;
            B.col[B.nc++]=40000;B.col[B.nc++]=42000;B.col[B.nc++]=46000;
          }
          B.idx[B.ni++]=base;B.idx[B.ni++]=base+1;B.idx[B.ni++]=base+2;
          B.idx[B.ni++]=base;B.idx[B.ni++]=base+2;B.idx[B.ni++]=base+3;
        }
      }
    }
    const cloudDefs=[];
    for(let i=0;i<26;i++){
      const a=rC()*Math.PI*2, rr=R-12+rC()*40;
      cloudDefs.push({x:CX+Math.cos(a)*rr, z:CZ+Math.sin(a)*rr,
        y:LAKE_Y-52+rC()*40, lobes:3+Math.floor(rC()*5)});
    }
    for(let i=0;i<4;i++){
      const a=rC()*Math.PI*2, rr=420+rC()*300;
      cloudDefs.push({x:CX+Math.cos(a)*rr, z:CZ+Math.sin(a)*rr, y:LAKE_Y+40+rC()*80, lobes:4+Math.floor(rC()*3)});
    }
    for(const cd of cloudDefs){
      for(let l=0;l<cd.lobes;l++){
        ellipsoid(cd.x+(rC()-0.5)*18, cd.y+(rC()-0.5)*5, cd.z+(rC()-0.5)*14,
          6+rC()*10, 2.5+rC()*2.5, 4+rC()*7, 2);
      }
    }
    const mesh=new THREE.Mesh(B.toGeometry(),cloudMat);
    mesh.frustumCulled=false;
    // translate the geometry so the group's origin is the island center:
    // cloudGrp.rotation.y then circles the clouds around the diorama forever
    mesh.geometry.translate(-CX,0,-CZ);
    cloudGrp.position.set(CX,0,CZ);
    cloudGrp.add(mesh);
    cloudGrp.userData={defs:cloudDefs,mesh};
    scene.add(cloudGrp);
  }

  /* flying Ford Anglia (animated mini-mesh) */
  const car=(function(){
    const grp=new THREE.Group();
    function bb(x0,x1,y0,y1,z0,z1,col){
      const g=new THREE.BoxGeometry(x1-x0+1,y1-y0+1,z1-z0+1);
      g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
      const m=new THREE.MeshBasicMaterial({color:col,vertexColors:false});
      return {g,m};
    }
    const parts=[];
    function add(x0,x1,y0,y1,z0,z1,col,over){
      const g=new THREE.BoxGeometry(x1-x0+1,y1-y0+1,z1-z0+1);
      g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
      const mat=new THREE.MeshBasicMaterial({color:col,toneMapped:over?false:true});
      if(over) mat.color.multiplyScalar(col.multiple||1);
      parts.push({g,mat,cast:true});
    }
    const bodyC=0x6d9cc2, chrome=0xb8bec6, winC=0x2c3a5a, tyre=0x141418;
    add(-2,2,0,0,-4,4,bodyC);                     // chassis 4×8 (front +z)
    add(-2,2,1,2,-2,1,winC); add(-2,2,1,2,2,3,winC); // window bands
    add(-2,-2,1,2,-2,3,bodyC); add(2,2,1,2,-2,3,bodyC); // corner pillars
    add(-2,2,3,3,-2,3,bodyC);                    // roof
    add(-2,2,0,0,5,5,chrome); add(-2,2,0,0,-5,-5,chrome); // bumpers
    for(const sx of [-2,2])for(const sz of [-3,3]) add(sx,sx,0,0,sz,sz,tyre);
    const hlF=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),
      new THREE.MeshBasicMaterial({color:new THREE.Color(2.4,2.2,1.5),toneMapped:false}));
    hlF.position.set(-1.5,1,4.5);
    const hlR=hlF.clone(); hlR.position.set(1.5,1,4.5);
    const tl=new THREE.Mesh(new THREE.BoxGeometry(3,0.8,0.6),
      new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,0.25,0.2),toneMapped:false}));
    tl.position.set(0,1,-5);
    const geos=parts.map(p=>p.g);
    const merged=mergeGeos(geos,parts.map(p=>p.mat));
    const mesh=new THREE.Mesh(merged.geom, merged.mats.length===1?merged.mats[0]:new THREE.MeshBasicMaterial());
    mesh.castShadow=false;
    grp.add(mesh);
    grp.add(hlF); grp.add(hlR); grp.add(tl);
    const beam=new THREE.PointLight(0xffd9a0,26,34,1.4);
    grp.add(beam); grp.userData.beam=beam;
    grp.scale.setScalar(1.3);
    grp.traverse(o=>{ if(o.isMesh) o.castShadow=false; });
    scene.add(grp);
    return grp;
  })();
  function mergeGeos(geos,mats){
    // simple non-indexed merge per material group → separate geometries joined by groups
    let vc=0; const newGeo=new THREE.BufferGeometry();
    const pos=[],nor=[],cols=[];
    const groups=[];
    for(let i=0;i<geos.length;i++){
      const g=geos[i].toNonIndexed();
      const start=pos.length/3;
      const P=g.attributes.position.array, N=g.attributes.normal.array;
      const col=new THREE.Color(mats[i].color?mats[i].color.getHex():0xffffff);
      for(let k=0;k<P.length;k++){pos.push(P[k]); cols.push(col.r,col.g,col.b);}
      for(let k=0;k<N.length;k++) nor.push(N[k]);
      groups.push({start,count:P.length/3,matIndex:0});
      g.dispose();
    }
    newGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    newGeo.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
    newGeo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
    const mat=new THREE.MeshBasicMaterial({vertexColors:true});
    return {geom:newGeo,mats:[mat]};
  }
  let carTheta=0.4;
  function updateCar(t,dt){
    carTheta+=0.1*dt;
    const th=carTheta;
    const x=148+98*Math.cos(th), y=PLAT_Y+50+10*Math.sin(2*th)+3*Math.sin(3*th), z=145+95*Math.sin(th);
    const bob=1.2*Math.sin(2.4*t)+0.3*Math.sin(5.3*t);
    car.position.set(x,y+bob,z);
    const th2=th+0.05;
    car.lookAt(148+98*Math.cos(th2), PLAT_Y+50+10*Math.sin(2*th2)+3*Math.sin(3*th2)+bob, 145+95*Math.sin(th2));
    car.rotateZ(0.16+0.1*Math.sin(1.7*t));
    car.rotateX(0.07*Math.sin(2.4*t+1));
    const fwd=new THREE.Vector3(0,0,1).applyQuaternion(car.quaternion);
    car.userData.beam.position.copy(fwd.multiplyScalar(9));
  }

  /* post-processing */
  let composer=null,bloom=null;
  function makeComposer(w,h){
    composer=new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene,null));
    bloom=new UnrealBloomPass(new THREE.Vector2(w,h),0.7,0.35,0.85);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  return {renderer,scene,mats,moonLight,moonGrp,cloudGrp,car,updateCar,
    getComposer:()=>composer, makeComposer, setCameraForPass:(cam)=>{ if(composer) composer.passes[0].camera=cam; }};
}

/* moon as skybox point (Section 11) — dir = from target toward the camera */
function placeMoon(moonGrp,camera,halfH,aspect,isOrtho,target){
  const dir=camera.position.clone().sub(target);
  if(dir.lengthSq()<1) return;
  dir.normalize();
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
  const up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
  const lz=-MOON_SKY.dot(dir);
  const lx=MOON_SKY.dot(right), ly=MOON_SKY.dot(up);
  if(lz<=0.05){ moonGrp.visible=false; return; }
  const tanV=isOrtho?Math.tan(55*Math.PI/180):Math.tan(camera.fov*Math.PI/360);
  const ndcX=(lx/lz)/(tanV*aspect), ndcY=(ly/lz)/tanV;
  if(Math.abs(ndcX)>1.6||Math.abs(ndcY)>1.6){ moonGrp.visible=false; return; }
  moonGrp.visible=true;
  const p=target.clone().addScaledVector(dir,-1400)
    .addScaledVector(up,ndcY*halfH)
    .addScaledVector(right,ndcX*halfH*aspect);
  moonGrp.position.copy(p);
  moonGrp.scale.setScalar(Math.max(0.35,halfH/300));
}
