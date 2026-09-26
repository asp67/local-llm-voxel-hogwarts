# -*- coding: utf-8 -*-
import io
p = "index.html"
s = io.open(p, encoding='utf-8').read()

HELP = """/* ==================== castle ==================== */
const beams=[];  // warm halo sprites: {x,y,z,s,c,o}
function squareTower(x0,z0,sx,sz,yb,yTop,opt={}){
  fillBox(x0,yb,z0, x0+sx,yTop,z0+sz, C.tan, {j:.07});
  for(let y=yb+4;y<yTop;y+=5) for(let x=x0;x<=x0+sx;x++)for(let z=z0;z<=z0+sz;z++){
    if(x===x0||x===x0+sx||z===z0||z===z0+sz) setV(x,y,z, jit(C.tanD,.05));
  }
  if(opt.win!==false){
    for(let x=x0+1;x<=x0+sx-1;x+=2){
      for(const zz of [z0, z0+sz]){ if(hasV(x,yb+7,zz)) winGlow(x,yb+7,zz); if(hasV(x,yb+10,zz)) winGlow(x,yb+10,zz); }
    }
  }
  merlonsRect(x0,z0,x0+sx,z0+sz,yTop+1,C.tan2);
}
function roundTower(cx,cz,r,yb,yTop,opt={}){
  const roof=opt.roof===undefined?C.slate:opt.roof;
  fillCyl(cx,cz,yb,yTop,r,C.tan,{j:.07});
  for(let y=yb+5;y<yTop-2;y+=6) fillDD(cx,y,cz,r,C.tanD,{j:.04});
  const rr=Math.round(r);
  for(let y=yb+4;y<yTop-3;y+=5){
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const px=cx+dx*rr, pz=cz+dz*rr;
      if(!hasV(px,y,pz)) continue;
      if(rnd()<0.55){ winGlow(px,y,pz); if(rnd()<0.5) winGlow(px,y+1,pz); }
    }
  }
  const tip = cone(cx,cz,yTop+1, r+1.6, roof, {ls:2,dec:1});
  if(opt.finial && tip){ setV(cx,tip,cz, pk(C.gold), true); beams.push({x:cx,y:tip+.5,z:cz,s:9,c:0xffd98c,o:.26}); }
  return tip;
}
function gableRoof(x0,z0,x1,z1,y0,axis,over=1,cA,cB){  // pitched roof; ridge along 'x'|'z'
  const alongX=(axis==='x');
  const a=cA||C.slate, b=cB||C.slate2;
  const mid = alongX ? Math.round((z0+z1)/2) : Math.round((x0+x1)/2);
  const span = alongX ? Math.min(z1-mid, mid-z0) : Math.min(x1-mid, mid-x0);
  const len0 = alongX ? x0 : z0, len1 = alongX ? x1 : z1;
  const s0 = alongX ? z0 : x0, s1 = alongX ? z1 : x1;
  for(let k=0;k<=span+over;k++){ const y=y0+k, half=span+over-k;
    const m0=Math.max(s0-1, mid-half), m1=Math.min(s1+1, mid+half);
    const body=(k&1)? b : a;
    if(alongX) fillBox(len0,y,m0, len1,y,m1, body,{j:.05});
    else fillBox(m0,y,len0, m1,y,len1, body,{j:.05});
    for(const ex of (alongX? [len0,len1] : [])) fillBox(ex,y,m0, ex,y,m1, C.tan2,{j:.05});
    for(const ez of (alongX? [] : [len0,len1])) fillBox(m0,y,ez, m1,y,ez, C.tan2,{j:.05});
  }
}
function bulb(cx,cz,y0,r,base){                              // squat dark onion dome
  fillDD(cx,y0,cz,r+0.8, base,{j:.05});
  fillDD(cx,y0+1,cz,r+0.9, base,{j:.05});
  fillDD(cx,y0+2,cz,r+0.6, base,{j:.05});
  return cone(cx,cz,y0+3, r+0.2, base, {ls:2,dec:1});
}
function windingPath(way,opt={}){                            // carved trail + lanterns
  const wob=opt.wob??0, lad=opt.lad||0;
  const pts=[];
  for(let s=0;s<way.length-1;s++){
    const [xa,za]=way[s], [xb,zb]=way[s+1];
    const n=Math.max(1,Math.round(Math.hypot(xb-xa,zb-za)));
    for(let i=(s===0?0:1);i<=n;i++){ const t=i/n;
      pts.push([xa+(xb-xa)*t, za+(zb-za)*t, Math.sin(t*9+ s*2)*wob]);
    }
  }
  const N=pts.length;
  let prev=64;
  for(let i=0;i<N;i++){
    const [fx,fz,w]=pts[i];
    const x=Math.round(fx+w), z=Math.round(fz+w);
    const dn=dnAt(x,z), t=topAt(x,z);
    if(t<-900||dn>79){ setV(x,45,z, jit(C.wood,.08)); prev=45; continue; }
    let y=Math.max(Math.min(t,prev+1), prev-1, 46);
    if(y<-900){ setV(x,45,z, jit(C.wood,.08)); prev=45; continue; }
    carveStep(x,z,y); prev=y;
    if(lad&&i%lad===6){
      const j=Math.min(N-1,i+5);
      const dxn=pts[j][0]-fx, dzn=pts[j][1]-fz, dl=Math.hypot(dxn,dzn)||1;
      const px=Math.round(x-dzn/dl*3), pz=Math.round(z+dxn/dl*3);
      setV(px,y+1,pz, jit(C.wood,.05));
      setV(px,y+2,pz, pk(C.lamp), true);
      beams.push({x:px,y:y+2.6,z:pz,s:6,c:0xffc678,o:.26});
    }
  }
}
function spanWalk(pts,yTop,opt={}){                          // raised wall-walk / curved viaduct
  const batt=opt.batt!==false, pierEvery=opt.pier||0, pierW=opt.pierW??1;
  for(let s=0;s<pts.length-1;s++){
    const [xa,za]=pts[s], [xb,zb]=pts[s+1];
    const n=Math.max(1,Math.round(Math.hypot(xb-xa,zb-za)));
    for(let i=(s===0?0:1);i<=n;i++){ const t=i/n;
      const x=Math.round(xa+(xb-xa)*t), z=Math.round(za+(zb-za)*t);
      setV(x,yTop,z, jit(C.chalk2,.05));
      if(!hasV(x,yTop-1,z)) for(let y=yTop-2;y<yTop;y++) setV(x,y,z, jit(C.chalk2,.06));
      if(batt&&((x+z)&1)===0){ setV(x,yTop+1,z, jit(C.chalk2,.06)); setV(x,yTop+2,z, jit(C.chalk,.06)); }
    }
  }
  if(!pierEvery) return;
  for(let s=0;s<pts.length-1;s++){
    const [xa,za]=pts[s], [xb,zb]=pts[s+1];
    const n=Math.max(1,Math.round(Math.hypot(xb-xa,zb-za)));
    for(let i=pierEvery;i<n;i+=pierEvery){
      const t=i/n, x=Math.round(xa+(xb-xa)*t), z=Math.round(za+(zb-za)*t);
      const g=findTop(x,z);
      if(g>=yTop-3){ setV(x,yTop-1,z, jit(C.tanD,.06)); continue; }
      const bot=Math.max(30,g+1);
      if(yTop-3>bot+5) for(let dx=0;dx<pierW;dx++) for(let dz=0;dz<pierW;dz++)
        fillBox(x+dx,bot,z+dz, x+dx,yTop-3,z+dz, C.tan2,{j:.06});
    }
  }
}
function latticeBridge(x0,z0,x1,z1,yTop){                    // straight girder causeway on slim piers
  const n=Math.max(1,Math.round(Math.hypot(x1-x0,z1-z0)));
  const ux=(x1-x0)/n, uz=(z1-z0)/n;
  const ox=Math.round(uz), oz=-Math.round(ux);
  for(let i=0;i<=n;i++){
    const x=Math.round(x0+ux*i), z=Math.round(z0+uz*i);
    setV(x,yTop,z, jit(C.chalk2,.05));
    for(const o of [-1,1]){
      const rx=x+ox*o, rz=z+oz*o;
      setV(rx,yTop,rz, jit(C.chalk2,.05));
      setV(rx,yTop+1,rz, jit(C.chalk2,.05));
      if((i&1)===0) setV(rx,yTop+2,rz, jit(C.chalk,.05));
      else          setV(rx,yTop+3,rz, jit(C.chalk,.05));
      if((i&1)===0) setV(rx,yTop+4,rz, jit(C.chalk,.05));
    }
    if(i%6===3){ fillBox(x,36,z, x,yTop-1,z, C.tanD,{j:.06}); setV(x,yTop+5,z, jit(C.chalk,.06)); }
  }
}
function isletPillar(x,z,rockTop){                           // rocky pillar rising from the loch
  fillCyl(x,z,6,rockTop,7.5, C.bedrock,{j:.06});
  fillDD(x,rockTop+1,z, 5.2, C.deep,{j:.06});
  fillDD(x,rockTop+2,z, 4.4, C.cobble2,{j:.05});
  return rockTop+2;
}

function buildCastle(){"""

marker = "function buildCastle(){"
i = s.index(marker)
s = s[:i] + HELP + s[i+len(marker):]
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print("helpers restored, bytes:", len(s))
print("braces:", s.count('{') - s.count('}'))
