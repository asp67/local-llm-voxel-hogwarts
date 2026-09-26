/* ===== 05_grounds.js — forest, Quidditch, Hagrid, boats, squid, train (Section 9) ===== */

function buildGrounds(){
  /* ---- Quidditch pitch on the grounds tier ---- */
  {
    const pcx=PX(800), pcz=PZ(330);
    const a=24, b=13, ty=GROUNDS_Y;
    oriented2D(pcx,pcz,0,a,b,(x,z,u,v)=>{
      const f=(u/a)*(u/a)+(v/b)*(v/b);
      if(f<=1){
        const t=topAt(x,z);
        if(t>=ty-1){
          let m=(Math.floor(u/3)%2===0)?MAT.GRASS:MAT.GRASS2;    // mowing stripes
          if(f>0.86) m=MAT.SAND;
          set(x,t,z,m);
        }
      }
      if(Math.abs(f-1)<0.09){ const t=topAt(x,z); if(t>=ty-1) set(x,t,z,MAT.SAND); }
      if(Math.abs(u)<2&&Math.abs(v)<2&&((u*u+v*v)|0)%3===0){ const t=topAt(x,z); if(t>=ty-1) set(x,t,z,MAT.PATH); }
    });
    for(const side of [-1,1]){
      for(const hh of [9,12,9]){
        const x=pcx+side*(a+2), z=pcz+[-6,0,6][[9,12,9].indexOf(hh)];
        for(let k=1;k<=hh;k++) set(x,ty+k,z,MAT.GOLD);
        disc(x,ty+hh,z,2,MAT.GOLD);
        for(let q=0;q<8;q++){ const a2=q/8*Math.PI*2;
          set(Math.round(x+Math.cos(a2)*2),ty+hh+Math.round(Math.sin(a2)*2)-0,z,MAT.GOLD); }
      }
    }
    const houseM=[MAT.RED,MAT.GREENH,MAT.BLUEH,MAT.YELL];
    for(let s=0;s<10;s++){
      const f=s/10*Math.PI*2;
      const x=pcx+Math.round(Math.cos(f)*(a+6)), z=pcz+Math.round(Math.sin(f)*(b+5));
      const t=topAt(x,z); if(t<ty-1) continue;
      const m=houseM[s%4];
      for(let k=1;k<=7;k++) for(let du=-1;du<=1;du++)for(let dv=-1;dv<=1;dv++)
        set(x+du,t+k,z+dv,(k<3)?MAT.STONE2:m);
      box(x-1,t+8,z-1,x+1,t+8,z+1,m);
      for(let w=0;w<4;w++) set(x-(Math.round(Math.cos(f))*3+w),t+2+w,z-(Math.round(Math.sin(f))*3+w),MAT.WOOD); // bleachers
    }
  }
  /* ---- Hagrid's hut ---- */
  {
    const hx=50, hz=190, t=topAt(hx,hz);
    cyl(hx,hz,t+1,t+5,4,MAT.PALEST);
    for(let k=0;k<7;k++) disc(hx,hz,t+6+k,Math.max(0.6,4-k*0.6),k%2?MAT.WOOD:MAT.WOOD2);
    set(hx,t+13,hz,MAT.WOOD2);
    for(let k=0;k<3;k++) set(hx+2,t+7+k,hz+2,MAT.IRON);
    set(hx+2,t+10,hz+2,MAT.LANT);                       // hanging lamp
    for(let a2=0;a2<6;a2++){                            // round lit windows
      const an=a2/6*Math.PI*2;
      const x=Math.round(hx+Math.cos(an)*4), z=Math.round(hz+Math.sin(an)*4);
      set(x,t+2,z, hash(x,41,z)<0.85?MAT.WIN:MAT.WINDK);
      set(x,t+3,z,MAT.WOOD);
    }
    for(let s=-1;s<=1;s++) for(let k=1;k<=4;k++) set(hx+s,t+k,hz+4,MAT.WOOD);   // door
    // pumpkin patch 3x3 + fence + lamp
    for(let dx=0;dx<3;dx++)for(let dz=0;dz<3;dz++){
      const x=hx+6+dx, z=hz-2+dz, tt=topAt(x,z);
      if(tt>=BASE_Y) set(x,tt+1,z,MAT.PUMPK);
    }
    for(let a2=0;a2<14;a2++){ const an=a2/14*Math.PI*2, rr=7.5;
      const x=Math.round(hx+Math.cos(an)*rr), z=Math.round(hz+Math.sin(an)*rr), tt=topAt(x,z);
      if(tt>=BASE_Y-1){ set(x,tt+1,z,MAT.WOOD); set(x,tt+2,z,MAT.WOOD);} }
    lamp(hx-6,hz+2,5);
    castleLights.push({x:hx,y:topAt(hx,hz)+3,z:hz,i:1.1});
  }
  /* ---- stone circle ---- */
  for(let i=0;i<11;i++){
    const a2=i/11*Math.PI*2, x=30+Math.round(Math.cos(a2)*6), z=160+Math.round(Math.sin(a2)*6);
    const t=topAt(x,z); if(t<BASE_Y) continue;
    const hh=3+((i*7)%3);
    for(let k=1;k<=hh;k++) set(x,t+k,z,MAT.PALEST);
    set(x,t+hh+1,z,MAT.PALEST);
  }
  /* ---- Whomping Willow ---- */
  {
    const wx0=72, wz0=150, t=topAt(wx0,wz0);
    box(wx0,t+1,wz0,wx0+1,t+9,wz0+1,MAT.TRUNK);
    for(let b=0;b<9;b++){
      const a2=b/9*Math.PI*2;
      let px=wx0+0.5, pz=wz0+0.5, py=t+8;
      let dx=Math.cos(a2)*0.75, dz=Math.sin(a2)*0.75, dy=0.55;
      for(let k=0;k<9;k++){
        px+=dx; pz+=dz; py+=dy; dy-=0.12;
        set(Math.round(px),Math.round(py),Math.round(pz),MAT.TRUNK);
        if(k>4&&hash(b,k,1)<0.7)
          for(let o=-1;o<=1;o++)set(Math.round(px)+o,Math.round(py)-1,Math.round(pz)+o,MAT.LEAF3);
      }
    }
    disc(wx0,wz0,t+10,2.5,MAT.LEAF);
  }
  /* ---- paths ---- */
  function path(pts,m){
    for(let s=0;s<pts.length-1;s++){
      const n=Math.max(1,Math.round(Math.hypot(pts[s+1][0]-pts[s][0],pts[s+1][1]-pts[s][1])));
      for(let i=0;i<=n;i++){
        const x=Math.round(pts[s][0]+(pts[s+1][0]-pts[s][0])*i/n);
        const z=Math.round(pts[s][1]+(pts[s+1][1]-pts[s][1])*i/n);
        const t=topAt(x,z);
        if(t>=BASE_Y-2&&t<PLAT_Y-2) set(x,t,z,m);
      }
    }
  }
  path([[240,1340],[150,1340],[80,1280],[50,1200],[45,200]],MAT.GRAVEL);
  path([[30,166],[60,150],[72,150]],MAT.GRAVEL);
  path([[50,198],[80,230],[120,240]],MAT.GRAVEL);
  /* ---- Forbidden Forest (occupancy spacing) ---- */
  const occ=new Uint8Array(W*D);
  function clearZones(x,z){
    // keep-clear: pitch, hut, circle, willow, station, boathouse
    const ppx=VX(x), ppz=VZ(z);
    if(inPoly(ppx,ppz,[[830,300],[770,220],[690,240],[640,320],[690,390],[800,400]])) return true;
    if(Math.hypot(x-50,z-190)<10) return true;
    if(Math.hypot(x-30,z-160)<10) return true;
    if(Math.hypot(x-72,z-150)<9) return true;
    if(x>236-6&&x<236+8&&z>66-4&&z<132+4) return true;
    if(Math.hypot(x-PX(1805),z-PZ(1700))<12) return true;
    return false;
  }
  function claim(x,z,sp){
    const gx=Math.floor(x/sp), gz=Math.floor(z/sp);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
      const ix=gx+dx, iz=gz+dz;
      if(ix<0||ix>=W/sp||iz<0||iz>=D/sp) continue;
      if(occ[ix+Math.floor(W/sp)*iz]) return false;
    }
    occ[gx+Math.floor(W/sp)*gz]=1; return true;
  }
  function pine(x,z,t){
    const hgt=5+Math.floor(rng()*7);
    cyl(x,z,t+1,t+hgt,0.6+ (hgt>9?0.4:0),MAT.TRUNK);
    const layers=3+((hgt>8)?1:0);
    for(let i=0;i<layers;i++){
      const rr=(layers-i)*(0.9+hash(x,i,z)*0.5)+0.8;
      cyl(x,z,t+hgt-layers*1.5+i*1.6|0, t+hgt-layers*1.5+i*1.6|0, rr, hash(x+i,z)<0.5?MAT.LEAF:MAT.LEAF3);
    }
  }
  function oak(x,z,t){
    const rr=2+rng()*1.6;
    cyl(x,z,t+1,t+3,0.7,MAT.TRUNK);
    for(let i=0;i<26;i++){
      const a2=rng()*Math.PI*2,b2=Math.acos(rng()*1.4-0.7);
      const dx=Math.round(Math.cos(a2)*Math.sin(b2)*rr), dz=Math.round(Math.sin(a2)*Math.sin(b2)*rr*1.15), dy=Math.round(Math.cos(b2)*rr*0.8);
      set(x+dx,t+4+dy,z+dz, hash(x+dy,z,i)<0.5?MAT.LEAF2:MAT.LEAF);
    }
  }
  const forestC=mulberry32(777);
  for(let i=0;i<9000;i++){
    const a2=forestC()*Math.PI*2, rr=Math.sqrt(forestC())*R*0.98;
    const x=Math.round(CX+Math.cos(a2)*rr), z=Math.round(CZ+Math.sin(a2)*rr);
    if(x<3||x>=W-3||z<3||z>=D-3) continue;
    const t=topAt(x,z);
    if(t<BASE_Y-2||t===LAKE_Y) continue;
    if(clearZones(x,z)) continue;
    const ppx=VX(x), ppz=VZ(z);
    const west=(ppx<760)||(ppz<420&&ppx<980)||(ppz>1500&&ppx<900);
    const dense=west && fbm(x*0.06+9,z*0.06+4)>0.33;
    let keep;
    if(dense) keep=forestC()<0.9;
    else if(t<BASE_Y+16) keep=forestC()<0.06;
    else keep=forestC()<0.015;
    if(!keep) continue;
    const sp=dense?3:4;
    if(!claim(x,z,sp)) continue;
    if(forestC()<0.62) pine(x,z,t); else oak(x,z,t);
    if(rng()<0.06){ // huts clear nothing
    }
  }
  /* ---- cliff bushes & mid grass ---- */
  for(let z=1;z<D-1;z++)for(let x=1;x<W-1;x++){
    const t=topAt(x,z);
    if(t<0||t>=PLAT_Y-2) continue;
    const m=get(x,t,z);
    if(m&&(PAL[m].name==='ROCK'||PAL[m].name==='MOSS')){
      if(hash(x,23,z)<0.11) box(x-1,t+1,z-1,x+1,t+2,z+1,hash(x,z,5)<0.5?MAT.LEAF:MAT.MOSS);
    }else if(m&&(PAL[m].name==='GRASS'||PAL[m].name==='GRASS2')){
      if(hash(x,24,z)<0.03) { set(x,t+1,z,MAT.LEAF2); if(hash(x,t,z)<0.4) set(x,t+2,z,MAT.LEAF2); }
    }
  }
  /* ---- boats flotilla (voxel coords 168–200, 238–245) ---- */
  for(let bx=168;bx<=200;bx+=6)for(let bz=238;bz<=245;bz+=5){
    const x=bx+Math.round((hash(x0(bx),bz)-0.5)*2), z=bz;
    if(get(x,LAKE_Y,z)!==MAT.WATER&&get(x,LAKE_Y,z)!==0) continue;
    for(let dx=-2;dx<=2;dx++)for(let dz=-1;dz<=1;dz++)
      if(Math.abs(dx)+Math.abs(dz)*1.4<=2.6) set(x+dx,LAKE_Y+1,z+dz,(Math.abs(dx)===2)?0:MAT.WOOD);
    set(x,LAKE_Y+1,z,MAT.WOOD2);
    set(x,LAKE_Y+2,z,MAT.IRON); set(x,LAKE_Y+3,z,MAT.CANDLE);
  }
  function x0(b){ return b*7; }
  /* ---- giant squid tentacles ---- */
  for(let tn=0;tn<4;tn++){
    const sx=150+tn*22, sz=240+ (tn%2)*14 - 6;
    let px=sx, pz=sz, py=LAKE_Y+1;
    let dx=(hash(tn,1,2)-0.5)*1.2, dz=(hash(tn,3,4)-0.3)*0.8, dy=1.0;
    for(let k=0;k<14;k++){
      px+=dx; pz+=dz; py+=dy; dy-=0.14;
      const rr=Math.max(0.6,2.2-k*0.12);
      disc(Math.round(px),Math.round(pz),Math.round(py),rr,MAT.SQUID);
    }
  }
  /* ---- Hogwarts Express & Hogsmeade station (east lower tier) ---- */
  {
    const tx=236;
    /* gravel bed + sleepers + rails */
    for(let z=34;z<=132;z++){
      const t=topAt(tx+1,z);
      if(t<0||t>PLAT_Y-2) continue;
      for(let x=tx-2;x<=tx+3;x++) set(x,t,z,MAT.GRAVEL);
      const rm=(z%4===0)?MAT.WOOD:MAT.IRON;
      set(tx-1,t+1,z,rm); set(tx+2,t+1,z,rm);
    }
    /* platform + lamps */
    for(let z=66;z<=132;z++)for(let x=tx+4;x<=tx+9;x++){
      const t=topAt(x,z); if(t<0||t>PLAT_Y-2)continue;
      set(x,t,z,MAT.PATH);
      if(z%11===0){ set(x,t+1,z,MAT.IRON);set(x,t+2,z,MAT.IRON);set(x,t+3,z,MAT.IRON);set(x,t+4,z,MAT.LANT); }
    }
    /* wooden station house */
    for(let z=96;z<=112;z++)for(let x=tx+5;x<=tx+9;x++){
      const t=topAt(x,z); if(t<0)continue;
      const edge=(x===tx+5||x===tx+9||z===96||z===112);
      if(edge) for(let k=1;k<=5;k++) set(x,t+k,z,MAT.WOOD);
      set(x,t+6,z,MAT.WOOD2);
      if(x===tx+7) set(x,t+7,z,MAT.WOOD2);
      if((z===100||z===108)&&(x===tx+5||x===tx+9)) set(x,t+3,z,MAT.LANT);
    }
    /* carriages: black roof, red body, lit windows on +x side */
    function carriage(z0c,z1c){
      for(let z=z0c;z<=z1c;z++)for(let x=tx;x<=tx+2;x++){
        const t=topAt(tx+1,z); if(t<0)continue;
        set(x,t+1,z,MAT.TRAINR); set(x,t+2,z,MAT.TRAINR); set(x,t+3,z,MAT.TRAINR);
        set(x,t+4,z,MAT.BLACK);
        if(x===tx+2&&(z-z0c)%3===0&&z>z0c+1&&z<z1c-1)
          set(x,t+2,z,hash(x,z,1)<0.8?MAT.WIN:MAT.WINDK);
        if(x===tx&&(z-z0c)%3===0) set(x,t+1,z,MAT.BLACK);   // coupling line
      }
    }
    carriage(36,48); carriage(50,62); carriage(64,76);
    /* locomotive z 78..92: black boiler + red cab + chimney + headlamp */
    for(let z=78;z<=92;z++)for(let x=tx;x<=tx+2;x++){
      const t=topAt(tx+1,z); if(t<0)continue;
      if(z<=86){ for(let k=1;k<=4;k++) set(x,t+k,z,MAT.BLACK); }
      else{ set(x,t+1,z,MAT.TRAINR); set(x,t+2,z,MAT.TRAINR); set(x,t+3,z,MAT.TRAINR); set(x,t+4,z,MAT.BLACK);
        if(x===tx+2&&z%2===0) set(x,t+2,z,MAT.WIN); }
    }
    { const t=topAt(tx+1,89);
      set(tx+1,t+5,89,MAT.BLACK); set(tx+1,t+6,89,MAT.BLACK);          // chimney
      set(tx+1,t+5,88,MAT.BLACK);
      set(tx,t+3,92,MAT.CANDLE); set(tx+1,t+3,92,MAT.CANDLE); set(tx+2,t+3,92,MAT.CANDLE); // headlamp
      set(tx-1,t+2,92,MAT.IRON); set(tx+3,t+2,92,MAT.IRON);             // bumpers
    }
    castleLights.push({x:tx+1,y:topAt(tx+1,92)+5,z:92,i:1.1});
  }
}
