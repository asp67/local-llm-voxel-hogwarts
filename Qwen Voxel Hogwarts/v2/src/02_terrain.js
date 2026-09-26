/* ===== 02_terrain.js — floating island (Section 6) ===== */
const FALL={x:Math.round(CX+0.2*R), z:Math.round(CZ+0.98*R)};

function inRect(px,py,x0,y0,x1,y1){ return px>=x0&&px<=x1&&py>=y0&&py<=y1; }
function inOrient(px,py,cx,cy,ang,hl,hw){
  const ca=Math.cos(-ang), sa=Math.sin(-ang), ux=px-cx, uy=py-cy;
  const du=ux*ca-uy*sa, dv=ux*sa+uy*ca;
  return Math.abs(du)<=hl&&Math.abs(dv)<=hw;
}
function inCircle(px,py,cx,cy,r){ const dx=px-cx,dy=py-cy; return dx*dx+dy*dy<=r*r; }
function inPoly(px,py,poly){
  let c=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [xi,yi]=poly[i],[xj,yj]=poly[j];
    if((yi>py)!==(yj>py) && px<(xj-xi)*(py-yi)/(yj-yi)+xi) c=!c;
  }
  return c;
}

const CASTLE_MASK=(px,py)=>
  inRect(px,py,1110,430,1590,1035) || inRect(px,py,945,585,1285,925) ||
  inRect(px,py,1265,570,1435,1150) || inRect(px,py,1185,1025,1515,1185) ||
  inRect(px,py,875,900,1095,1100)  || inRect(px,py,1090,900,1225,1030) ||
  inOrient(px,py,835,640,-22*Math.PI/180,150,95) ||
  inOrient(px,py,890,700,19*Math.PI/180,125,55) ||
  inRect(px,py,1025,365,1185,600)  || inRect(px,py,755,1160,1135,1515) ||
  inCircle(px,py,1100,1490,115) ||
  inOrient(px,py,1125,1655,-34.9*Math.PI/180,240,95) ||
  inRect(px,py,405,1240,715,1435) ||
  inCircle(px,py,1330,1600,45);
const GROUNDS_POLY=[[1110,360],[1000,175],[890,125],[660,135],[520,330],[470,420],[560,520],[720,520],[950,560],[1070,560]];

const regions=[
  {h:PLAT_Y-1, slope:2.6, mask:CASTLE_MASK},
  {h:GROUNDS_Y, slope:1.6, mask:(px,py)=>inPoly(px,py,GROUNDS_POLY)},
];
const hills=[
  {cx:50, cz:190, r:9,  h:BASE_Y+3},   // Hagrid's hill (voxel coords)
  {cx:30, cz:160, r:10, h:BASE_Y+4},   // stone circle hill
];
const boathouseRock={x0:PX(1740),z0:PZ(1600),x1:PX(1880),z1:PZ(1790),h:LAKE_Y+2};

function distField(maskFn){
  const INF=1e9, a=1.0, bg=Math.SQRT2;
  const d=new Float32Array(W*D);
  for(let z=0;z<D;z++)for(let x=0;x<W;x++)
    d[x+W*z]=maskFn(VX(x),VZ(z))?0:INF;
  for(let z=0;z<D;z++)for(let x=0;x<W;x++){
    let v=d[x+W*z];
    if(x>0)v=Math.min(v,d[x-1+W*z]+a);
    if(z>0)v=Math.min(v,d[x+W*(z-1)]+a);
    if(x>0&&z>0)v=Math.min(v,d[x-1+W*(z-1)]+bg);
    if(x<W-1&&z>0)v=Math.min(v,d[x+1+W*(z-1)]+bg);
    d[x+W*z]=v;
  }
  for(let z=D-1;z>=0;z--)for(let x=W-1;x>=0;x--){
    let v=d[x+W*z];
    if(x<W-1)v=Math.min(v,d[x+1+W*z]+a);
    if(z<D-1)v=Math.min(v,d[x+W*(z+1)]+a);
    if(x<W-1&&z<D-1)v=Math.min(v,d[x+1+W*(z+1)]+bg);
    if(x>0&&z<D-1)v=Math.min(v,d[x-1+W*(z+1)]+bg);
    d[x+W*z]=v;
  }
  return d;
}
const regionDist=regions.map(r=>distField(r.mask));

function islandRadiusAt(x,z){
  const a=Math.atan2(z-CZ,x-CX);
  return R + (vnoise(Math.cos(a)*2.4+7.7,Math.sin(a)*2.4+3.1)-0.5)*5.0;   // ±2.5 jitter
}
function lakeField(x,z){ return (z-CZ) + 0.25*(x-CX) - 36 + (fbm(x*0.045+11,z*0.045+13)-0.5)*40; }

// single shared formula so the underside carve and the stalactites attach to the
// exact same surface (previously pass 5 recomputed differently → detached bits)
function underYb(x,z){
  const t=Math.min(Math.hypot(x-CX,z-CZ)/R,1);
  let depth=8+46*(1-Math.pow(t,1.5))+fbm(x*0.07+21,z*0.07+29)*12;
  depth=Math.round(depth/6)*6;
  return Math.max(0,LAKE_Y-6-depth);
}

function buildTerrain(){
  /* pass 1: column top heights */
  const hgt=new Int16Array(W*D);
  for(let z=0;z<D;z++)for(let x=0;x<W;x++){
    const gi=x+W*z;
    const nz=fbm(x*0.06+3,z*0.06+5);
    let h=BASE_Y + Math.floor(nz*10-4);
    for(let r=0;r<regions.length;r++){
      const d=regionDist[r][gi];
      const drop=Math.round(d*regions[r].slope*(0.65+0.8*nz)/3)*3;  // 3-voxel terraces
      h=Math.max(h,regions[r].h-drop);
    }
    for(const hl of hills){
      const d=Math.hypot(x-hl.cx,z-hl.cz);
      if(d<=hl.r-2.5) h=Math.max(h,hl.h);
      else if(d<=hl.r){ const top=BASE_Y+Math.floor(nz*10-4); h=Math.max(h, Math.max(top, hl.h-Math.round((d-(hl.r-2.5))*2/3)*1)); }
    }
    if(x>=boathouseRock.x0&&x<=boathouseRock.x1&&z>=boathouseRock.z0&&z<=boathouseRock.z1)
      h=Math.max(h,boathouseRock.h);
    if(h>BASE_Y+2 && hash(x,1,z)<0.10) h+=1;            // random 1-voxel ledges
    hgt[gi]=h;
  }
  /* pass 2: lake carving, beach, stone lip, waterfall gap */
  const isWater=new Uint8Array(W*D);   // 1 = water column, 2 = waterfall notch
  for(let z=0;z<D;z++)for(let x=0;x<W;x++){
    const gi=x+W*z;
    if(Math.hypot(x-CX,z-CZ)>islandRadiusAt(x,z)){ hgt[gi]=-999; continue; }
    const lake=lakeField(x,z);
    const h=hgt[gi];
    if(lake>0 && h<PLAT_Y-2){
      const bed=Math.max(LAKE_Y-9, Math.min(LAKE_Y-2, h-Math.round(lake*0.7)));
      hgt[gi]=Math.min(h,bed);
      isWater[gi]=1;
    }else if(lake>-5 && lake<=0 && h<LAKE_Y+3){
      hgt[gi]=LAKE_Y+1;                                  // beach band
    }
  }
  for(let z=0;z<D;z++)for(let x=0;x<W;x++){
    const gi=x+W*z; if(!isWater[gi])continue;
    let landN=false,waterN=false;
    for(const [ox,oz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+ox,nz=z+oz; if(nx<0||nx>=W||nz<0||nz>=D)continue;
      const ngi=nx+W*nz;
      if(!isWater[ngi]&&hgt[ngi]>LAKE_Y+2) landN=true;
      if(isWater[ngi]) waterN=true;
    }
    if(landN&&waterN&&hash(x,9,z)<0.8) hgt[gi]=LAKE_Y+2; // stone lip
  }
  { // waterfall gap through the lip
    const fr=1.75;
    for(let z=Math.round(FALL.z-fr-1);z<=FALL.z+fr+1;z++)for(let x=Math.round(FALL.x-fr-1);x<=FALL.x+fr+1;x++){
      if(x<0||x>=W||z<0||z>=D)continue;
      if(Math.hypot(x-FALL.x,z-FALL.z)<=fr){ const gi=x+W*z;
        if(Math.hypot(x-CX,z-CZ)<=islandRadiusAt(x,z)){ hgt[gi]=LAKE_Y; isWater[gi]=2; } }
    }
  }
  const strata=y=>{ const b=((y + (fbm(3.7,9.1)*8))|0)%9; return b<4?MAT.ROCK:(b<6?MAT.ROCK2:MAT.ROCK3); };
  /* pass 3: fill solid columns + surface materials */
  for(let z=0;z<D;z++)for(let x=0;x<W;x++){
    const gi=x+W*z, h=hgt[gi];
    if(h===-999) continue;
    if(isWater[gi]===1){
      // cube-aligned lake: bed flush at the grid, water exactly one voxel thick,
      // its top face landing exactly on the LAKE_Y plane. A varying bed depth
      // created tall water slabs with exposed side walls = offset "floating" faces.
      for(let y=0;y<=LAKE_Y-2;y++) set(x,y,z,strata(y));   // bed up to cell 61
      set(x,LAKE_Y-1,z,MAT.WATER);                         // water cell 62 (occupies 62..63)
      topY[gi]=LAKE_Y;
      continue;
    }
    if(isWater[gi]===2){
      for(let y=0;y<=LAKE_Y-3;y++) set(x,y,z,strata(y));         // solid under the notch
      topY[gi]=LAKE_Y-3;
      continue;
    }
    let topMat;
    const steep=(()=>{ let dr=0;
      for(const [ox,oz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+ox,nz=z+oz; if(nx<0||nx>=W||nz<0||nz>=D)continue;
        const nh=hgt[nx+W*nz]; if(nh!==-999) dr=Math.max(dr,h-nh);
      } return dr; })();
    if(h>=PLAT_Y-4) topMat=(fbm(x*0.1+2,z*0.1+2)>0.55)?MAT.MOSS:(hash(x,2,z)<0.5?MAT.GRASS:MAT.GRASS2);
    else if(h<=LAKE_Y+2) topMat=MAT.SAND;
    else if(h>=LAKE_Y+8) topMat=(hash(x,3,z)<0.4)?MAT.GRASS:MAT.MOSS;
    else topMat=MAT.MOSS;
    if(steep>2) topMat=(hash(x,4,z)<0.5)?MAT.ROCK:(h>=PLAT_Y-2?MAT.ROCK3:MAT.MOSS);
    for(let y=0;y<=h;y++){
      const dy=h-y; let m;
      if(dy===0) m=topMat;
      else if(dy<3&&h>=LAKE_Y+2) m=MAT.DIRT;
      else m=strata(y);
      set(x,y,z,m);
    }
    topY[gi]=h;
  }
  /* pass 4: underside carve — inverted stepped cone */
  for(let z=0;z<D;z++)for(let x=0;x<W;x++){
    const gi=x+W*z, h=topY[gi];
    if(h<0) continue;
    const yb=underYb(x,z);
    for(let y=0;y<yb&&y<=h;y++) grid[idx(x,y,z)]=0;
    for(let y=Math.max(0,yb-1);y<yb+9&&y<=h;y++){
      if(grid[idx(x,y,z)]!==0){
        const b=(y+((fbm(x*0.1+5,z*0.1+7)*8)|0))%7;
        set(x,y,z,b<3?MAT.UNDER:(b<5?MAT.ROCK2:MAT.ROCK));
      }
    }
  }
  /* pass 5: stalactites + crystal tips — attached with the SAME underYb() */
  for(let i=0;i<70;i++){
    const a=rng()*Math.PI*2, rr=rng()*R*0.85;
    const x=Math.round(CX+Math.cos(a)*rr), z=Math.round(CZ+Math.sin(a)*rr);
    if(x<4||x>=W-4||z<4||z>=D-4) continue;
    const gi=x+W*z; if(topY[gi]<0) continue;
    const yb=underYb(x,z);
    const r0=2+Math.floor(rng()*3), len=6+Math.floor(rng()*13);
    for(let s=0;s<len;s++){
      const y=yb-s; if(y<1)break;
      const rr2=Math.max(0.6,r0-s*0.28);
      disc(x,z,y,rr2, s%2?MAT.UNDER:MAT.ROCK2);
    }
    const ty=yb-len;
    if(ty>=1&&rng()<0.4){ disc(x,z,ty,1,MAT.CRYST); set(x,ty-1,z,MAT.CRYST); }
  }
  /* pass 6: waterfall spilling over the lip */
  {
    const dx=0.24, dz=0.97;
    for(let s=0;s<=72;s++){
      const out=Math.sqrt(s)*0.9;
      const fx=Math.round(FALL.x+dx*out), fz=Math.round(FALL.z+dz*out);
      const fy=Math.round(LAKE_Y - s*0.82);
      if(fy<2)break;
      const w=1+Math.floor(out*0.3);
      for(let ox=-w;ox<=w;ox++)for(let oz=-w;oz<=w;oz++){
        const xx=fx+ox,zz=fz+oz;
        if(xx<0||xx>=W||zz<0||zz>=D)continue;
        set(xx,fy,zz, (s>52)?MAT.FOAM:MAT.WATER);
      }
    }
  }
}
