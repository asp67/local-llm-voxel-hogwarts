/* ===== 01_core.js — grid, constants, palette, noise, RNG, primitives ===== */
import * as THREE from 'three';

function showFatal(msg,hint){ var e=document.getElementById('err');
  document.getElementById('errmsg').textContent=msg;
  document.getElementById('errhint').textContent=hint||'';
  e.style.display='flex'; document.getElementById('loader').style.display='none'; }
window.__pageErrors=window.__pageErrors||[];
window.addEventListener('error',function(ev){ window.__pageErrors.push(String(ev.message||ev)); });

/* ---- grid ---- */
const W=288, H=208, D=288;
const CX=144, CZ=144, R=132;
const LAKE_Y=63, BASE_Y=65, PLAT_Y=100;
const GROUNDS_Y=BASE_Y+18;
const S=0.12;
const grid=new Uint8Array(W*H*D);               // material id, 0 = air
const topY=new Int16Array(W*D).fill(-999);       // terrain top per column; -999 = off-island air
function idx(x,y,z){ return x + W*(z + D*y); }
function inb(x,y,z){ return x>=0&&x<W&&y>=0&&y<H&&z>=0&&z<D; }
function get(x,y,z){ return inb(x,y,z)?grid[idx(x,y,z)]:0; }
function set(x,y,z,m){ if(x>=0&&x<W&&y>=0&&y<H&&z>=0&&z<D) grid[idx(x,y,z)]=m; }

/* ---- palette ---- */
const PAL=[];
const MAT={};
function mat(name,hex,kind,vary){
  // r160 ColorManagement already converts the sRGB hex to linear working space
  const c=new THREE.Color(hex);
  PAL.push({name,r:c.r,g:c.g,b:c.b,kind,vary:vary||0});
  MAT[name]=PAL.length-1;
}
mat('AIR',0x000000,1,0);                        // id 0 reserved
mat('STONE','#857563',1,0.05);
mat('STONE2','#665a4d',1,0.05);
mat('STONE3','#a1917b',1,0.05);
mat('ROOF','#33457e',1,0.05);
mat('ROOF2','#243260',1,0.05);
mat('COPPER','#4f9483',1,0.05);
mat('WIN','#ffa845',2,0.10);
mat('WIN2','#ffcf78',2,0.08);
mat('WINDK','#1a2034',1,0.04);
mat('GRASS','#3b5a2d',1,0.07);
mat('GRASS2','#2f4b27',1,0.07);
mat('MOSS','#46552f',1,0.09);
mat('DIRT','#5a4532',1,0.05);
mat('ROCK','#5d5852',1,0.05);
mat('ROCK2','#4a4540',1,0.05);
mat('ROCK3','#6e675e',1,0.05);
mat('UNDER','#3a332e',1,0.05);
mat('WATER','#1c3f78',3,0.06);
mat('FOAM','#9fc3e8',3,0.04);
mat('GLASS','#86c7b4',4,0.03);
mat('WOOD','#5a3b22',1,0.06);
mat('WOOD2','#7b5534',1,0.06);
mat('TRUNK','#3a2a1b',1,0.06);
mat('LEAF','#1f3b26',1,0.10);
mat('LEAF2','#2b4b2b',1,0.10);
mat('LEAF3','#162c1e',1,0.10);
mat('LANT','#ffcf6b',2,0.06);
mat('CANDLE','#fff1c4',2,0.04);
mat('PATH','#7a7062',1,0.05);
mat('GRAVEL','#6b6357',1,0.06);
mat('SAND','#8a7b5f',1,0.05);
mat('GOLD','#d4a93a',1,0.04);
mat('RED','#8e1f1f',1,0.04);
mat('GREENH','#1f6b3a',1,0.04);
mat('BLUEH','#23408e',1,0.04);
mat('YELL','#c9a227',1,0.04);
mat('PUMPK','#d9731c',1,0.07);
mat('PALEST','#9b978f',1,0.05);
mat('CLOCK','#e8dcb0',2,0.03);
mat('TRAINR','#9b1b1b',1,0.04);
mat('BLACK','#1b1b20',1,0.03);
mat('IRON','#2b2b31',1,0.04);
mat('CARB','#6d9cc2',1,0.03);
mat('PLANT','#3f7a3a',1,0.10);
mat('SQUID','#3d2c44',1,0.06);
mat('CRYST','#6fb6ff',2,0.08);
const KIND=m=>PAL[m].kind;
const isOpaque=m=>{ const k=PAL[m].kind; return k===1||k===2; };

/* ---- noise / rng ---- */
function hash(x,y,z){
  let n=(Math.imul(x|0,374761393)^Math.imul(y|0,1103515245)^Math.imul(z|0,668265263))|0;
  n=Math.imul(n^(n>>>13),1274126177); n=Math.imul(n^(n>>>16),2654435761); n^=n>>>15;
  return (n>>>0)/4294967296;
}
function vnoise(x,z){
  const ix=Math.floor(x), iz=Math.floor(z), fx=x-ix, fz=z-iz;
  const u=fx*fx*(3-2*fx), w=fz*fz*(3-2*fz);
  const a=hash(ix,0,iz), b=hash(ix+1,0,iz), c=hash(ix,0,iz+1), d=hash(ix+1,0,iz+1);
  return (a*(1-u)+b*u)*(1-w)+(c*(1-u)+d*u)*w;
}
function fbm(x,z,oct){
  oct=oct||4; let s=0,amp=0.5,f=1,n=0;
  for(let i=0;i<oct;i++){ s+=vnoise(x*f,z*f)*amp; n+=amp; amp*=0.5; f*=2; }
  return s/n;
}
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296; }; }
const rng=mulberry32(19910731);

/* ---- plan-pixel mapping (Section 3) ---- */
const PX = px => Math.round(CX + (px-1100)*S);
const PZ = py => Math.round(CZ + (py-1080)*S);
const VX = x => (x-CX)/S + 1100;                 // voxel → plan px (for masks)
const VZ = z => (z-CZ)/S + 1080;

/* ---- primitives ---- */
function box(x0,y0,z0,x1,y1,z1,m){
  if(x1<x0){const t=x0;x0=x1;x1=t;} if(z1<z0){const t=z0;z0=z1;z1=t;} if(y1<y0){const t=y0;y0=y1;y1=t;}
  for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)set(x,y,z,m);
}
function shell(x0,y0,z0,x1,y1,z1,t,m){
  for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
    if(x<=x0+t-1||x>=x1-t+1||z<=z0+t-1||z>=z1-t+1||y<=y0+t-1||y>=y1-t+1) set(x,y,z,m);
  }
}
function cyl(cx,cz,y0,y1,r,m,squash){
  const r2=r*r, iX=Math.ceil(r);
  for(let y=y0;y<=y1;y++)for(let dz=-iX;dz<=iX;dz++)for(let dx=-iX;dx<=iX;dx++){
    const dd=squash? (dx*dx)/(squash*squash)+dz*dz : dx*dx+dz*dz;
    if(dd<=r2+r*0.7) set(cx+dx,y,cz+dz,m);
  }
}
function disc(cx,cz,y,r,m){ cyl(cx,cz,y,y,r,m); }
function drop(cx,cz,y0,y1,m){ for(let y=y1;y<=y0;y++) set(cx,y,cz,m); }
// foundation: fill from (x,z,y) downward until solid ground (max depth)
function plinth(x,z,y,depth,m){
  for(let i=0;i<depth;i++){ const yy=y-i; if(yy<0)break;
    if(grid[idx(x,yy,z)]!==0 && PAL[grid[idx(x,yy,z)]].kind===1) break;
    set(x,yy,z,m); }
}
function line3(x0,y0,z0,x1,y1,z1,m,thick){
  thick=thick||1;
  const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0),Math.abs(z1-z0));
  for(let i=0;i<=n;i++){
    const x=Math.round(x0+(x1-x0)*i/n), y=Math.round(y0+(y1-y0)*i/n), z=Math.round(z0+(z1-z0)*i/n);
    for(let a=0;a<thick;a++)for(let b=0;b<thick;b++) set(x+a,y,z+b,m);
  }
}
// iterate integer local coords inside an oriented rectangle; u along length, v across
function oriented2D(cx,cz,ang,hl,hw,fn){
  const ca=Math.cos(ang), sa=Math.sin(ang);
  const span=Math.ceil(Math.max(hl,hw)*1.45);
  for(let du=-span;du<=span;du++)for(let dv=-span;dv<=span;dv++){
    const wx=Math.round(cx + du*ca - dv*sa);
    const wz=Math.round(cz + du*sa + dv*ca);
    const ul=Math.round(du), vl=Math.round(dv);
    if(Math.abs(ul)<=hl && Math.abs(vl)<=hw) fn(wx,wz,ul,vl);
  }
}
