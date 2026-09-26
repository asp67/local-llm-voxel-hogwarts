/* ===== 06_mesher.js — voxel → triangles (Section 10) ===== */
/* Faces: normal n, axes u,v with u×v=n; corners o, o+u, o+u+v, o+v (CCW from outside) */
const FACES=[
  {n:[1,0,0],  u:[0,1,0], v:[0,0,1]},
  {n:[-1,0,0], u:[0,0,1], v:[0,1,0]},
  {n:[0,1,0],  u:[0,0,1], v:[1,0,0]},
  {n:[0,-1,0], u:[1,0,0], v:[0,0,1]},
  {n:[0,0,1],  u:[1,0,0], v:[0,1,0]},
  {n:[0,0,-1], u:[0,1,0], v:[1,0,0]},
];
/* verify u×v=n: (0,1,0)×(0,0,1)=(1,0,0) ✓; (0,0,1)×(0,1,0)=(-1,0,0) ✓; (0,0,1)×(1,0,0)=(0,1,0)✓; (1,0,0)×(0,0,1)=(0,-1,0)✓; (1,0,0)×(0,1,0)=(0,0,1)✓; (0,1,0)×(1,0,0)=(0,0,-1)✓ */
const AO_LUT=[0.42,0.62,0.80,1.0];

/* growable compact buffers */
function makeBuf(){
  let cap=1<<16;
  return {
    cap,
    pos:new Int16Array(cap*3), np:0,
    col:new Uint16Array(cap*3), nc:0,
    nor:new Int8Array(cap*3),   nn:0,
    idx:new Uint32Array(cap*3*2), ni:0,
    ensure(add){
      if(this.np/3+add<=this.cap) return;
      let c=this.cap; while(c<this.np/3+add) c*=2;
      const p=new Int16Array(c*3); p.set(this.pos.subarray(0,this.np)); this.pos=p;
      const co=new Uint16Array(c*3); co.set(this.col.subarray(0,this.nc)); this.col=co;
      const n=new Int8Array(c*3); n.set(this.nor.subarray(0,this.nn)); this.nor=n;
      const i=new Uint32Array(c*3); i.set(this.idx.subarray(0,this.ni)); this.idx=i;
      this.cap=c;
    },
    vertCount(){ return this.np/3; },
    reset(){ this.np=this.nc=this.nn=this.ni=0; },
    toGeometry(){
      const g=new THREE.BufferGeometry();
      const nv=this.np/3;
      g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0,this.np),3,false));
      g.setAttribute('color',    new THREE.BufferAttribute(this.col.slice(0,this.nc),3,true));
      g.setAttribute('normal',   new THREE.BufferAttribute(this.nor.slice(0,this.nn),3,true));
      g.setIndex(new THREE.BufferAttribute(this.idx.slice(0,this.ni),1,false));
      g.computeBoundingSphere();
      return g;
    }
  };
}

function buildChunkMeshes(scene, mats, onProgress, done){
  const CS=48;
  const cxN=Math.ceil(W/CS), cyN=Math.ceil(H/CS), czN=Math.ceil(D/CS);
  const bufs=[makeBuf(),makeBuf(),makeBuf(),makeBuf()];   // solid, emissive, water, glass
  const solid=B=>B;
  let vi=0;
  function emitFace(kind, fi, x,y,z, m, ao){
    const B=bufs[kind]; const f=FACES[fi];
    B.ensure(4);
    const base=B.vertCount();
    const p=PAL[m];
    const n=[f.n[0],f.n[1],f.n[2]];
    let jr=1;
    if(p.vary>0) jr=1+(hash(x*3+fi,y*3,z*3)-0.5)*2*p.vary;
    if(kind===1) jr=1;                       // emissive: keep bright, uniform
    for(let k=0;k<4;k++){
      const [du,dv]=[[0,0],[1,0],[1,1],[0,1]][k];
      // block (x,y,z) spans the unit cube [x,x+1]×[y,y+1]×[z,z+1];
      // the face plane is at the + boundary for n>0 and at the cell coord for n<0
      const px=x+(n[0]>0?1:0)+f.u[0]*du+f.v[0]*dv;
      const py=y+(n[1]>0?1:0)+f.u[1]*du+f.v[1]*dv;
      const pz=z+(n[2]>0?1:0)+f.u[2]*du+f.v[2]*dv;
      B.pos[B.np++]=px; B.pos[B.np++]=py; B.pos[B.np++]=pz;
      B.nor[B.nn++]=n[0]*127; B.nor[B.nn++]=n[1]*127; B.nor[B.nn++]=n[2]*127;
      const a=ao[k];
      B.col[B.nc++]=Math.max(0,Math.min(65535,Math.round(p.r*jr*a*65535)));
      B.col[B.nc++]=Math.max(0,Math.min(65535,Math.round(p.g*jr*a*65535)));
      B.col[B.nc++]=Math.max(0,Math.min(65535,Math.round(p.b*jr*a*65535)));
    }
    // flip diagonal to smooth AO
    if(ao[0]+ao[2]<ao[1]+ao[3])
      B.idx.set([base+1,base+2,base+3, base+1,base+3,base+0], B.ni), B.ni+=6;
    else
      B.idx.set([base+0,base+1,base+2, base+0,base+2,base+3], B.ni), B.ni+=6;
  }
  const faceAO=(fi,x,y,z)=>{
    const f=FACES[fi], o=[x,y,z], n=f.n;
    // neighbour plane cells
    const nx=o[0]+n[0], ny=o[1]+n[1], nz=o[2]+n[2];
    const aov=[];
    for(const [du,dv] of [[0,0],[1,0],[1,1],[0,1]]){
      const du2=du*2-1, dv2=dv*2-1;
      const s1=get(nx+f.u[0]*du2, ny+f.u[1]*du2, nz+f.u[2]*du2);
      const s2=get(nx+f.v[0]*dv2, ny+f.v[1]*dv2, nz+f.v[2]*dv2);
      const cn=get(nx+f.u[0]*du2+f.v[0]*dv2, ny+f.u[1]*du2+f.v[1]*dv2, nz+f.u[2]*du2+f.v[2]*dv2);
      const lv=(isOpaque(s1)&&isOpaque(s2))?0:3-(isOpaque(s1)+isOpaque(s2)+isOpaque(cn));
      aov.push(AO_LUT[lv]);
    }
    return aov;
  };
  let ci=0, total=cxN*cyN*czN;
  function chunkStep(){
    const x0=(ci%cxN)*CS, y0=Math.floor(ci/cxN)%cyN*CS, z0=Math.floor(ci/(cxN*cyN))*CS;
    const x1=Math.min(W,x0+CS), y1=Math.min(H,y0+CS), z1=Math.min(D,z0+CS);
    for(let y=y0;y<y1;y++)for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){
      const m=grid[idx(x,y,z)];
      if(!m) continue;
      const kind=PAL[m].kind;          // 1 solid, 2 emissive, 3 water, 4 glass
      for(let fi=0;fi<6;fi++){
        const f=FACES[fi];
        const nb=get(x+f.n[0], y+f.n[1], z+f.n[2]);
        let emit=false;
        if(kind===1||kind===2) emit = !(nb&&isOpaque(nb));
        else if(kind===3)      emit = (!nb)||PAL[nb].kind===4;
        else                   emit = (!nb)||PAL[nb].kind===3;
        if(!emit) continue;
        let ao;
        if(kind===1) ao=faceAO(fi,x,y,z);
        else if(kind===2){ const a=faceAO(fi,x,y,z).map(v=>Math.max(v,AO_LUT[2])); ao=a; }
        else ao=[1,1,1,1];
        emitFace(kind===1?0:(kind===2?1:(kind===3?2:3)), fi,x,y,z,m,ao);
      }
    }
    ci++;
    if(onProgress) onProgress(ci/total);
    if(ci<total) setTimeout(chunkStep,0);
    else{
      for(let k=0;k<4;k++){
        const B=bufs[k];
        if(B.np===0) continue;
        const g=B.toGeometry();
        const mesh=new THREE.Mesh(g, mats[k]);
        mesh.frustumCulled=false;
        scene.add(mesh);
      }
      done(bufs.reduce((s,B)=>s+B.ni/3,0));
    }
  }
  setTimeout(chunkStep,0);
}
