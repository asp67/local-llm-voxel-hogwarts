/* ===== 03_buildings.js — architecture kit (Section 7) ===== */

function groundBelow(x,z,y){
  if(x<0||x>=W||z<0||z>=D) return -1;
  for(let yy=y;yy>=0;yy--){ const m=grid[idx(x,yy,z)]; if(m&&PAL[m].kind===1) return yy; }
  return -1;
}
function litWindow(x,y,z,kind){ set(x,y,z,kind||MAT.WIN); }
function toWorld(cx,cz,ang,u,v){
  const ca=Math.cos(ang), sa=Math.sin(ang);
  return [Math.round(cx+u*ca-v*sa), Math.round(cz+u*sa+v*ca)];
}

/* ---- hall(o) ----
   o: cx,cz,ang,hl,hw,y0,h,roof('gable'|'hip'|'flat'),roofH,win('normal'|'gothic'|'none'),
      ev,floorH,buttress,crenel,machi,dormers,litP,stone,trim,roofMat,bright,arches,winKind */
function hall(o){
  const y0=o.y0!==undefined?o.y0:PLAT_Y;
  const ang=o.ang||0, hl=o.hl, hw=o.hw, h=o.h||16;
  const stone=o.stone||MAT.STONE, trim=o.trim||MAT.STONE3, pb=MAT.STONE2;
  const roofM=o.roofMat||MAT.ROOF, roof2=o.roof2Mat||MAT.ROOF2;
  const litP=(o.litP!==undefined?o.litP:0.6)*0.72;
  const winKind=o.winKind||MAT.WIN;
  const ev=o.ev||3, floorH=o.floorH||6;

  /* foundation plinths down to ground (masonry on cliff edges) */
  oriented2D(o.cx,o.cz,ang,hl,hw,(wx,wz)=>{
    const g=groundBelow(wx,wz,y0-1);
    for(let y=y0-1;y>g&&y>=y0-70;y--) set(wx,y,wz,pb);
  });

  /* solid walls with plinth, string courses, quoins */
  oriented2D(o.cx,o.cz,ang,hl,hw,(wx,wz,u,v)=>{
    const edgeX=Math.abs(u)>=hl-1, edgeZ=Math.abs(v)>=hw-1;
    const edge=edgeX||edgeZ;
    const corner=edgeX&&edgeZ;
    for(let fy=0;fy<h;fy++){
      if(o.arches&&fy<5&&(edgeZ)&&u%4!==0) continue;      // ground-floor arcade
      let m=stone;
      if(corner) m=trim;
      else if(edge){
        if(fy<2) m=pb;
        else if(fy%floorH===0) m=pb;
        else if((u+v)%2===0&&fy%2===1) m=trim;             // quoin/texture band
      }
      set(wx,y0+fy,wz,m);
    }
  });

  /* windows on faces */
  if(o.win==='normal'){
    for(let fy=2;fy<h-2;fy++){
      if(fy%2!==0) continue;
      const base=fy%floorH;
      const useRow=(base===2||base===3);
      if(!useRow) continue;
      for(let u=-hl+2;u<=hl-2;u++){
        if(u%ev!==0) continue;
        for(const v of [-hw,hw]){
          const lit=hash(u+hl,fy*7,v+hl*3+o.cx)<litP;
          const wm=lit?winKind:MAT.WINDK;
          const [x1,z1]=toWorld(o.cx,o.cz,ang,u,v);
          const [x2,z2]=toWorld(o.cx,o.cz,ang,u,v+(v>0?1:-1)); // surface voxel
          set(x1,fy+y0,z1,wm); set(x2,fy+y0,z2,wm);
          if(base===2){ set(x1,fy-1+y0,z1,trim); set(x2,fy-1+y0,z2,trim); }
        }
      }
      for(let v=-hw+2;v<=hw-2;v++){
        if(v%ev!==0) continue;
        for(const u of [-hl,hl]){
          const lit=hash(u*3+o.cz,v+fy*11,fy)<litP;
          const wm=lit?winKind:MAT.WINDK;
          const [x1,z1]=toWorld(o.cx,o.cz,ang,u,v);
          const [x2,z2]=toWorld(o.cx,o.cz,ang,u+(u>0?1:-1),v);
          set(x1,fy+y0,z1,wm); set(x2,fy+y0,z2,wm);
        }
      }
    }
  }else if(o.win==='gothic'){
    const row0=Math.floor(h*0.35);
    for(let u=-hl+2;u<=hl-2;u+=3){
      for(const v of [-hw,hw]){
        const [x1,z1]=toWorld(o.cx,o.cz,ang,u,v);
        const [x2,z2]=toWorld(o.cx,o.cz,ang,u,v+(v>0?1:-1));
        for(let k=0;k<6;k++){
          const fy=row0+k; if(fy>=h-1)break;
          const m=k===3?trim:(hash(u+k*13,fy,v)<0.92?winKind:MAT.WINDK);
          set(x1,fy+y0,z1,m); set(x2,fy+y0,z2,m);
        }
      }
    }
    for(let v=-hw+2;v<=hw-2;v+=3){
      for(const u of [-hl,hl]){
        const [x1,z1]=toWorld(o.cx,o.cz,ang,u,v);
        const [x2,z2]=toWorld(o.cx,o.cz,ang,u+(u>0?1:-1),v);
        for(let k=0;k<6;k++){
          const fy=row0+k; if(fy>=h-1)break;
          const m=k===3?trim:(hash(v,k*17,fy+u)<0.92?winKind:MAT.WINDK);
          set(x1,fy+y0,z1,m); set(x2,fy+y0,z2,m);
        }
      }
    }
  }

  /* buttresses along the long faces */
  if(o.buttress){
    for(let u=-hl+2;u<=hl-2;u+=o.buttress){
      for(const s of [-1,1]){
        const [wx,wz]=toWorld(o.cx,o.cz,ang,u,s*(hw+1));
        for(let fy=0;fy<h-2;fy++) set(wx,y0+fy,wz,(fy>h-6)?trim:pb);
        set(wx,y0+h-2,wz,trim);
      }
    }
  }
  /* machicolation ring */
  if(o.machi){
    oriented2D(o.cx,o.cz,ang,hl+1,hw+1,(wx,wz,u,v)=>{
      const ring=(Math.abs(u)>=hl||Math.abs(v)>=hw);
      if(!ring) return;
      set(wx,y0+h+o.machi-1,wz,trim);
      if((u+37*v)%2===0){ set(wx,y0+h+o.machi,wz,trim); set(wx,y0+h+o.machi+1,wz,trim); }
    });
    oriented2D(o.cx,o.cz,ang,hl,hw,(wx,wz)=>set(wx,y0+h+o.machi-2,wz,stone));
  }
  const topRow=y0+h+(o.machi?o.machi+2:0)-(o.crenel?0:0);

  if(o.roof==='gable'){
    const roofH=o.roofH||hw+2;
    for(let k=0;k<=roofH;k++){
      const vMax=Math.round((hw+1)*(1-k/roofH));
      oriented2D(o.cx,o.cz,ang,hl+((k===0)?1:0),Math.max(0,vMax),(wx,wz,u,v)=>{
        const eave=Math.abs(v)>=vMax||k===0;
        if(k>0&&!eave) return;
        set(wx,topRow+k,wz,(eave&&k!==roofH)?roof2:roofM);
      });
    }
    for(const su of [-hl,hl]){
      const roofH2=o.roofH||hw+2;
      for(let k=0;k<=roofH2;k++){
        const vMax=Math.round((hw+1)*(1-k/roofH2));
        for(let v=-vMax;v<=vMax;v++){
          const [wx,wz]=toWorld(o.cx,o.cz,ang,su,v);
          set(wx,topRow+k,wz,k===roofH2?roof2:(hash(v,k,99)<0.5?trim:stone));
        }
        if(k===Math.floor(roofH2*0.45)&&roofH2>=5){
          const [wx,wz]=toWorld(o.cx,o.cz,ang,su,0);
          litWindow(wx,topRow+k,wz,winKind);
        }
      }
    }
    if(o.dormers){
      const roofH2=o.roofH||hw+2;
      for(let u=-hl+2;u<hl-1;u+=4){
        const kk=Math.min(3,Math.max(2,roofH2-2));
        const vMax=Math.max(0,Math.round((hw+1)*(1-kk/roofH2)));
        for(const s of [-1,1]){
          const [wx,wz]=toWorld(o.cx,o.cz,ang,u,s*Math.max(1,vMax));
          set(wx,topRow+kk+1,wz,hash(u,s)<litP?winKind:MAT.WINDK);
          set(wx,topRow+kk+2,wz,roof2);
        }
      }
    }
  }else if(o.roof==='hip'){
    const roofH=o.roofH||hw+2;
    for(let k=0;k<=roofH;k++){
      const ul=Math.max(0,Math.round(hl*(1-k/roofH)));
      const vl=Math.max(0,Math.round(hw*(1-k/roofH)));
      if(ul===0&&vl===0){ const [wx,wz]=toWorld(o.cx,o.cz,ang,0,0); set(wx,topRow+k,wz,k===roofH?MAT.COPPER:roof2); continue; }
      oriented2D(o.cx,o.cz,ang,(k===0?hl+1:ul),Math.max(vl,(k===0?hw+1:0)*1),(wx,wz,u,v)=>{
        const ring=Math.abs(u)>=ul||Math.abs(v)>=vl;
        if(!ring&&k>0) return;
        set(wx,topRow+k,wz,(k===0||k===roofH)?roof2:roofM);
      });
    }
  }else{ // flat
    oriented2D(o.cx,o.cz,ang,hl,hw,(wx,wz)=>set(wx,topRow,wz,pb));
    if(o.crenel!==false){
      oriented2D(o.cx,o.cz,ang,hl,hw,(wx,wz,u,v)=>{
        if((Math.abs(u)>=hl-1||Math.abs(v)>=hw-1)&&(u+37*v)%2===0){ set(wx,topRow+1,wz,trim); set(wx,topRow+2,wz,trim); }
      });
    }
  }
}

/* ---- roundTower(o) ---- */
function roundTower(o){
  const y0=o.y0!==undefined?o.y0:PLAT_Y, r=o.r, h=o.h||20;
  const stone=o.stone||MAT.STONE, trim=o.trim||MAT.STONE3, pb=MAT.STONE2;
  const roofM=o.roofMat||MAT.ROOF, roof2=o.roof2Mat||MAT.ROOF2;
  const litP=(o.litP!==undefined?o.litP:0.6)*0.72;
  const winN=o.winN||Math.max(2,Math.round(1.4*r));
  const machi=o.machi||0;
  // foundation
  { const g=groundBelow(o.x,o.z,y0-1);
    for(let y=y0-1;y>g&&y>=y0-70;y--) cyl(o.x,o.z,y,y,Math.max(1,r-1),pb); }
  cyl(o.x,o.z,y0,y0+h-1,r,stone);
  cyl(o.x,o.z,y0,y0+1,r,pb);
  for(let fy=3;fy<h-2;fy+=7)for(let k=0;k<winN;k++){
    const a=k/winN*Math.PI*2+fy*0.35;
    const x=Math.round(o.x+Math.cos(a)*r), z=Math.round(o.z+Math.sin(a)*r);
    const lit=hash(o.x+k,fy,o.z)<litP;
    for(let s=0;s<2;s++) set(x,y0+fy+s,z,lit?(o.winKind||MAT.WIN):MAT.WINDK);
    set(x,y0+fy-1,z,trim);
  }
  const top=y0+h-1+machi;
  if(machi){
    cyl(o.x,o.z,y0+h,y0+h+machi-1,r+1,trim);
    for(let k=0;k<winN;k++){ const a=k/winN*Math.PI*2;
      const x=Math.round(o.x+Math.cos(a)*(r+1)), z=Math.round(o.z+Math.sin(a)*(r+1));
      if((k+17)%2===0) set(x,top,z,stone); }
  }
  if(o.crenel!==false&&r>=2){
    const ring=r+1;
    const n=Math.max(6,winN*2);
    for(let k=0;k<n;k++){ const a=k/n*Math.PI*2;
      const x=Math.round(o.x+Math.cos(a)*ring), z=Math.round(o.z+Math.sin(a)*ring);
      if(k%2===0){ set(x,top+1,z,trim); set(x,top+2,z,trim); } }
  }
  const coneH=o.coneH||Math.round(2.8*r+3);
  if(o.cone!==false){
    const R0=(o.crenel!==false)?Math.max(1.2,r-0.6):r+1.2;
    let sp=top+1+coneH;
    for(let k=0;k<=coneH;k++){
      const rr=Math.max(0.55,R0*Math.pow(1-k/coneH,1.08));
      disc(o.x,o.z,top+1+k,rr, k===0||k===coneH?roof2:roofM);
      if(k>1&&k<coneH-1&&k%6===0){
        for(let q=0;q<8;q++){ const a=q/8*Math.PI*2+k;
          const x=Math.round(o.x+Math.cos(a)*(rr+0.35)), z=Math.round(o.z+Math.sin(a)*(rr+0.35));
          if(hash(o.x+k,q,z)<0.8) litWindow(x,top+1+k,z,MAT.WIN); }
      }
    }
    set(o.x,sp,o.z,roof2); set(o.x,sp+1,o.z,MAT.COPPER);
    for(let s=2;s<2+(o.spire||0);s++) set(o.x,sp+s,o.z,MAT.COPPER);
  }else set(o.x,top+1,o.z,pb);
}

/* ---- squareTower(o) ---- */
function squareTower(o){
  hall({cx:o.x,cz:o.z,ang:o.ang||0,hl:o.s,hw:o.s,y0:o.y0,h:o.h,roof:'hip',
    roofH:o.roofH||(o.s+4),win:o.win||'normal',ev:o.ev||3,litP:o.litP,
    buttress:o.buttress,crenel:o.crenel,stone:o.stone,trim:o.trim,roofMat:o.roofMat});
  if(o.pinnacle){
    // corner pinnacles rise from the top of the wall, not from the roof apex
    const yy=(o.y0||PLAT_Y)+(o.h||16);
    for(const du of [-1,1])for(const dv of [-1,1]){
      const [wx,wz]=toWorld(o.x,o.z,o.ang||0,du*o.s,dv*o.s);
      set(wx,yy,wz,MAT.STONE3);
      set(wx,yy+1,wz,MAT.STONE3); set(wx,yy+2,wz,MAT.ROOF); set(wx,yy+3,wz,MAT.COPPER);
    }
  }
}

/* ---- bridge(o) ---- */
function bridge(o){
  const y=o.y, w=o.w||3;
  const deckM=o.deck||MAT.STONE3;
  const n=Math.max(1,Math.ceil(Math.hypot(o.x1-o.x0,o.z1-o.z0)));
  const dx=(o.x1-o.x0)/n, dz=(o.z1-o.z0)/n;
  const hl=Math.hypot(dx,dz)||1, px=-dz/hl, pz=dx/hl;
  const half=(w>>1);
  for(let i=0;i<=n;i++){
    const cx=o.x0+dx*i, cz=o.z0+dz*i;
    for(let v=-half;v<=half;v++){
      const x=Math.round(cx+px*v), z=Math.round(cz+pz*v);
      set(x,y,z,deckM); set(x,y-1,z,o.truss?MAT.WOOD:MAT.STONE2);
      if(Math.abs(v)===half){
        set(x,y+1,z,o.truss?MAT.WOOD:MAT.STONE3);
        if(!o.truss&&i%2===0) set(x,y+2,z,MAT.STONE2);
      }
    }
    if(o.lanternEvery&&i>0&&i<n&&i%o.lanternEvery===0){
      const x=Math.round(cx+px*(half+1)), z=Math.round(cz+pz*(half+1));
      set(x,y+1,z,MAT.IRON); set(x,y+2,z,MAT.IRON); set(x,y+3,z,MAT.LANT);
    }
    if(o.covered){
      for(const s of [-1,1]){
        const x=Math.round(cx+px*s*half), z=Math.round(cz+pz*s*half);
        set(x,y+1,z,o.truss?MAT.WOOD:MAT.STONE2);
        set(x,y+2,z,o.truss?MAT.WOOD:MAT.STONE2);
      }
      for(let v=-half;v<=half;v++)
        set(Math.round(cx+px*v),y+3+Math.min(2,Math.abs(v)),Math.round(cz+pz*v),i%2?MAT.ROOF:MAT.ROOF2);
    }
    if(!o.truss&&o.pierEvery&&i%o.pierEvery===0){
      for(let v=-1;v<=1;v++)for(let u=-1;u<=1;u++){
        const x=Math.round(cx+px*v+px*0+u*px*0+u*pz*0), z=Math.round(cz+pz*v+u*px*0);
        const xx=Math.round(cx+u*px+v*px*0), zz2=Math.round(cz+u*pz+v*px*0);
        for(let yy=y-2;yy>=0;yy--){
          const m=get(xx,yy,zz2);
          if(m&&PAL[m].kind===1&&yy<y-4) break;
          set(xx,yy,zz2,(y-yy)%7<4?MAT.STONE2:MAT.STONE);
          if(yy<=2)break;
        }
      }
    }
    if(o.truss&&i%3===0){
      for(const s of [-1,1]){
        const x=Math.round(cx+px*s*half), z=Math.round(cz+pz*s*half);
        for(let k=1;k<=3;k++) set(x,y-k,z,MAT.WOOD);
      }
    }
  }
}

/* ---- stairPath(pts, yA, yB, w, lantEvery) ---- */
function stairPath(pts,yA,yB,w,lantEvery){
  const segs=[]; let total=0;
  for(let s=0;s<pts.length-1;s++){
    const [ax,az]=pts[s],[bx,bz]=pts[s+1];
    const L=Math.max(1,Math.round(Math.hypot(bx-ax,bz-az)));
    segs.push({ax,az,bx,bz,L,s0:total}); total+=L;
  }
  let lastLant=-99;
  for(let i=0;i<=total;i++){
    const f=i/total, y=Math.round(yA+(yB-yA)*f);
    let seg=segs[segs.length-1];
    for(const sg of segs){ if(i<=sg.s0+sg.L){ seg=sg; break; } }
    const t=Math.min(1,(i-seg.s0)/seg.L);
    const cx=seg.ax+(seg.bx-seg.ax)*t, cz=seg.az+(seg.bz-seg.az)*t;
    const ddx=(seg.bx-seg.ax)/seg.L, ddz=(seg.bz-seg.az)/seg.L;
    const hl2=Math.hypot(ddx,ddz)||1, px=-ddz/hl2, pz=ddx/hl2;
    for(let v=-w;v<=w;v++){
      const x=Math.round(cx+px*v), z=Math.round(cz+pz*v);
      for(let k=1;k<5;k++){ const m=get(x,y+k,z); if(m&&PAL[m].kind===1) set(x,y+k,z,0); }
      set(x,y,z,(i+v)%2===0?MAT.STONE3:MAT.STONE2);
      if(Math.abs(v)===w) set(x,y+1,z,MAT.STONE2);
      for(let s2=1;s2<=70;s2++){
        const yy=y-s2; if(yy<0)break;
        if(get(x,yy,z)!==0) break;
        set(x,yy,z,yy<LAKE_Y?MAT.STONE2:MAT.STONE);
      }
    }
    if(lantEvery&&i-lastLant>=lantEvery&&i>0&&i<total){
      lastLant=i;
      const x=Math.round(cx+px*(w+1)), z=Math.round(cz+pz*(w+1));
      set(x,y+1,z,MAT.IRON); set(x,y+2,z,MAT.IRON); set(x,y+3,z,MAT.IRON); set(x,y+4,z,MAT.LANT);
    }
  }
}
