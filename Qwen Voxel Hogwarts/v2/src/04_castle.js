/* ===== 04_castle.js — Hogwarts layout (Section 8; plan px via PX/PZ) ===== */
const castleLights=[];   // {x,y,z,i} collected for Section 11

function topAt(x,z){ const g=x+W*z; return (g>=0&&g<W*D)?topY[g]:-999; }
function paveRect(x0,z0,x1,z1,m,skip){
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
    if(x<0||x>=W||z<0||z>=D) continue;
    const ty=topAt(x,z);
    if(ty>=PLAT_Y-2) set(x,ty,z, hash(x,7,z)<(skip||0.2)?MAT.GRASS:m);
  }
}
function paveOrient(cx,cz,ang,hl,hw,m){
  oriented2D(cx,cz,ang,hl,hw,(x,z)=>{ const ty=topAt(x,z); if(ty>=PLAT_Y-2) set(x,ty,z,m); });
}
function lamp(x,z,h){ const ty=Math.max(topAt(x,z),LAKE_Y+2);
  for(let k=1;k<=h;k++) set(x,ty+k,z,MAT.IRON); set(x,ty+h+1,z,MAT.LANT); return [x,ty+h+1,z]; }

function fountain(cx,cz){
  const ty=topAt(cx,cz);
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)
    if(Math.abs(dx)===2||Math.abs(dz)===2) set(cx+dx,ty+1,cz+dz,MAT.STONE3);
  set(cx,ty+1,cz,MAT.WATER); set(cx+1,ty+1,cz,MAT.WATER); set(cx,ty+1,cz+1,MAT.WATER); set(cx+1,ty+1,cz+1,MAT.WATER);
  set(cx,ty+2,cz,MAT.STONE3); set(cx,ty+3,cz,MAT.STONE3);
  castleLights.push({x:cx,y:ty+4,z:cz,i:1});
}
function greenhouse(x0,y0,x1,y1){ // plan rect px
  const X0=PX(x0),X1=PX(x1),Z0=PZ(y0),Z1=PZ(y1);
  const ty=topAt(X0,Z0);
  for(let z=Z0;z<=Z1;z++)for(let x=X0;x<=X1;x++){
    const edge=(x===X0||x===X1||z===Z0||z===Z1);
    for(let k=1;k<=3;k++) set(x,ty+k,z, (edge&&((x+z)%4===0))?MAT.IRON:MAT.GLASS);
    if(!edge) set(x,ty+1,z,MAT.PLANT);
  }
  const span=Z1-Z0;
  for(let k=0;k<=3;k++){
    const za=Z0+Math.round(span*k/3*0.5), zb=Z1-Math.round(span*k/3*0.5);
    for(let x=X0;x<=X1;x++){
      if(za<=zb){ set(x,ty+4+k,za,k%2?MAT.IRON:MAT.GLASS); set(x,ty+4+k,zb,k%2?MAT.GLASS:MAT.IRON); }
    }
  }
  set(Math.round((X0+X1)/2),ty+2,Z0,MAT.LANT);
}
function lowWall(x0,z0,x1,z1){
  const ty=topAt(x0,z0);
  for(const [sx,sz,ex,ez] of [[x0,z0,x1,z0],[x0,z1,x1,z1],[x0,z0,x0,z1],[x1,z0,x1,z1]]){
    const n=Math.max(Math.abs(ex-sx),Math.abs(ez-sz));
    for(let i=0;i<=n;i++){
      const x=Math.round(sx+(ex-sx)*i/n), z=Math.round(sz+(ez-sz)*i/n);
      const t=topAt(x,z); if(t<PLAT_Y-3) continue;
      set(x,t+1,z,MAT.STONE); set(x,t+2,z,MAT.STONE);
      if((x+z)%2===0) set(x,t+3,z,MAT.STONE3);
    }
  }
}
function rampart(pts){
  for(let s=0;s<pts.length-1;s++){
    const [ax,ay]=pts[s],[bx,by]=pts[s+1];
    const X0=PX(ax),Z0=PZ(ay),X1=PX(bx),Z1=PZ(by);
    const n=Math.max(1,Math.round(Math.hypot(X1-X0,Z1-Z0)));
    for(let i=0;i<=n;i++){
      const x=Math.round(X0+(X1-X0)*i/n), z=Math.round(Z0+(Z1-Z0)*i/n);
      const t=topAt(x,z); if(t<BASE_Y+6) continue;
      for(let k=1;k<=5;k++) set(x,t+k,z,MAT.STONE2);
      if((x*3+z)%2===0){ set(x,t+6,z,MAT.STONE3); set(x,t+7,z,MAT.STONE3); }
    }
    const t=topAt(X1,Z1);
    if(t>=BASE_Y+6) roundTower({x:X1,z:Z1,r:2.6,h:12,y0:t+1,coneH:6,litP:0.3});
  }
}

function buildCastle(){
  /* ---------- greenhouse compound (NE) ---------- */
  paveRect(PX(1120),PZ(450),PX(1580),PZ(1020),MAT.GRAVEL,0.35);
  for(let x=PX(1140);x<=PX(1560);x+=Math.round(90*S)) for(let z=PZ(470);z<=PZ(1000);z+=2) set(x,topAt(x,z),z,MAT.PATH);
  lowWall(PX(1110),PZ(430),PX(1590),PZ(430));
  lowWall(PX(1590),PZ(430),PX(1590),PZ(1035));
  const gh=[[1130,470,1300,505],[1130,530,1300,560],[1395,470,1560,505],[1395,530,1560,560],
            [1470,580,1510,730],[1525,580,1565,730],[1470,745,1510,890],[1525,745,1565,890]];
  for(const g of gh) greenhouse(g[0],g[1],g[2],g[3]);
  { const gx=PX(1350),gz=PZ(448), ty=topAt(gx,gz);   // octagonal glass pavilion
    cyl(gx,gz,ty+1,ty+6,4,MAT.GLASS);
    for(let k=0;k<5;k++) disc(gx,gz,ty+7+k,Math.max(0.6,4-k*0.8),k%2?MAT.GLASS:MAT.IRON);
    set(gx,ty+12,gz,MAT.GOLD); set(gx,ty+13,gz,MAT.GOLD);
    castleLights.push({x:gx,y:ty+5,z:gz,i:0.8});
  }

  /* ---------- north quadrangle ---------- */
  hall({cx:(PX(960)+PX(1275))/2|0,cz:(PZ(605)+PZ(680))/2|0,ang:0,
    hl:(PX(1275)-PX(960))/2|0,hw:(PZ(680)-PZ(605))/2|0,h:24,roof:'gable',win:'normal',dormers:true});
  hall({cx:(PX(960)+PX(1030))/2|0,cz:(PZ(605)+PZ(915))/2|0,ang:0,
    hl:(PX(1030)-PX(960))/2|0,hw:(PZ(915)-PZ(605))/2|0,h:24,roof:'gable',win:'normal',dormers:true});
  { const X0=PX(1032),X1=PX(1270),Z0=PZ(682),Z1=PZ(910);
    paveRect(X0+2,Z0+2,X1-2,Z1-2,MAT.STONE3,0.0);   // cloister floor
    paveRect(PX(1060),PZ(700),PX(1240),PZ(880),MAT.GRASS,0); // lawn
    for(let x=X0;x<=X1;x+=3)for(const z of [Z0,Z1]){ const ty=topAt(x,z);
      set(x,ty+1,z,MAT.STONE2);set(x,ty+2,z,MAT.STONE2);set(x,ty+3,z,MAT.STONE2);set(x,ty+4,z,MAT.STONE2);
      set(x,ty+5,z,MAT.STONE3);set(x,ty+6,z,MAT.ROOF2); }
    for(let z=Z0;z<=Z1;z+=3)for(const x of [X0,X1]){ const ty=topAt(x,z);
      set(x,ty+1,z,MAT.STONE2);set(x,ty+2,z,MAT.STONE2);set(x,ty+3,z,MAT.STONE2);set(x,ty+4,z,MAT.STONE2);
      set(x,ty+5,z,MAT.STONE3);set(x,ty+6,z,MAT.ROOF2); }
    fountain(PX(1150),PZ(790));
    for(const [lx,ly] of [[1050,700],[1250,700],[1050,880],[1250,880]]) lamp(PX(lx),PZ(ly),4);
  }

  /* ---------- spine & gothic towers ---------- */
  hall({cx:(PX(1275)+PX(1425))/2|0,cz:(PZ(590)+PZ(910))/2|0,ang:0,
    hl:(PX(1425)-PX(1275))/2|0,hw:(PZ(910)-PZ(590))/2|0,h:26,roof:'gable',roofH:11,buttress:4,dormers:true,win:'normal'});
  hall({cx:(PX(1310)+PX(1390))/2|0,cz:(PZ(905)+PZ(1150))/2|0,ang:0,
    hl:(PX(1390)-PX(1310))/2|0,hw:(PZ(1150)-PZ(905))/2|0,h:22,roof:'gable',win:'gothic'});
  squareTower({x:PX(1280),z:PZ(612),s:4,h:40,roofH:24,win:'gothic',pinnacle:true});
  squareTower({x:PX(1410),z:PZ(612),s:4,h:40,roofH:24,win:'gothic',pinnacle:true});
  squareTower({x:PX(1345),z:PZ(598),s:3,h:36,roofH:34,win:'gothic',pinnacle:true});
  hall({cx:(PX(1220)+PX(1500))/2|0,cz:(PZ(910)+PZ(1030))/2|0,ang:0,
    hl:(PX(1500)-PX(1220))/2|0,hw:(PZ(1030)-PZ(910))/2|0,h:24,roof:'gable',dormers:true});
  squareTower({x:PX(1350),z:PZ(958),s:6,h:34,roofH:16,pinnacle:true,dormers:false});
  hall({cx:(PX(1225)+PX(1500))/2|0,cz:(PZ(1055)+PZ(1145))/2|0,ang:0,
    hl:(PX(1500)-PX(1225))/2|0,hw:(PZ(1145)-PZ(1055))/2|0,h:22,roof:'gable',buttress:3,dormers:true});
  roundTower({x:PX(1215),z:PZ(1062),r:Math.round(30*S*10)/10,h:30});
  roundTower({x:PX(1480),z:PZ(1062),r:Math.round(30*S*10)/10,h:30});
  roundTower({x:PX(1215),z:PZ(1142),r:Math.round(36*S*10)/10,h:26});
  roundTower({x:PX(1480),z:PZ(1142),r:Math.round(36*S*10)/10,h:26});
  { const X0=PX(1095),X1=PX(1220),Z0=PZ(905),Z1=PZ(1025);
    paveRect(X0,Z0,X1,Z1,MAT.PATH,0);
    fountain((X0+X1)/2|0,(Z0+Z1)/2|0);
  }

  /* ---------- west blocks ---------- */
  hall({cx:(PX(1000)+PX(1075))/2|0,cz:(PZ(915)+PZ(1030))/2|0,ang:0,
    hl:(PX(1075)-PX(1000))/2|0,hw:(PZ(1030)-PZ(915))/2|0,h:24,roof:'gable',dormers:true});
  hall({cx:(PX(890)+PX(1000))/2|0,cz:(PZ(960)+PZ(1030))/2|0,ang:0,
    hl:(PX(1000)-PX(890))/2|0,hw:(PZ(1030)-PZ(960))/2|0,h:20,roof:'gable',dormers:true});
  roundTower({x:PX(945),z:PZ(1035),r:Math.round(55*S*10)/10,h:20,coneH:13,win:'slits',litP:0.4});
  roundTower({x:PX(897),z:PZ(960),r:2.5,h:27,coneH:8});
  roundTower({x:PX(1000),z:PZ(953),r:2.5,h:29,coneH:8});
  roundTower({x:PX(945),z:PZ(920),r:2.5,h:31,coneH:9});
  bridge({x0:PX(885),z0:PZ(990),x1:PX(575),z1:PZ(968),y:PLAT_Y,w:3,lanternEvery:8,pierEvery:9});
  { const gx=PX(560),gz=PZ(966);
    roundTower({x:gx,z:gz,r:3,h:10,coneH:10,y0:PLAT_Y,litP:0.9}); }

  /* ---------- NW angled wing & grounds ---------- */
  hall({cx:PX(830),cz:PZ(605),ang:-22*Math.PI/180,hl:11,hw:7,h:28,roof:'gable',dormers:true,buttress:3});
  hall({cx:PX(890),cz:PZ(700),ang:19*Math.PI/180,hl:12,hw:3,h:20,roof:'gable'});
  roundTower({x:PX(848),z:PZ(745),r:2.5,h:26,coneH:9});
  roundTower({x:PX(922),z:PZ(770),r:2.5,h:24,coneH:8});
  squareTower({x:PX(735),z:PZ(575),s:3,h:36,roofH:22,ang:-22*Math.PI/180});
  hall({cx:PX(1100),cz:PZ(420),ang:-25*Math.PI/180,hl:7,hw:4,h:14,roof:'gable'});
  roundTower({x:PX(1155),z:PZ(405),r:2.5,h:20,coneH:8});
  bridge({x0:PX(1080),z0:PZ(465),x1:PX(1122),z1:PZ(605),y:PLAT_Y,w:3,covered:true});
  rampart([[1090,380],[990,190],[945,165],[885,140],[670,150],[535,345],[505,405]]);
  roundTower({x:PX(505),z:PZ(405),r:4.5,h:30,coneH:14,litP:0.06});   // owlery

  /* ---------- courtyard block ---------- */
  hall({cx:(PX(780)+PX(1060))/2|0,cz:(PZ(1180)+PZ(1265))/2|0,ang:0,
    hl:(PX(1060)-PX(780))/2|0,hw:(PZ(1265)-PZ(1180))/2|0,h:26,roof:'gable',buttress:3,dormers:true});
  hall({cx:(PX(780)+PX(860))/2|0,cz:(PZ(1180)+PZ(1500))/2|0,ang:0,
    hl:(PX(860)-PX(780))/2|0,hw:(PZ(1500)-PZ(1180))/2|0,h:26,roof:'gable',dormers:true});
  hall({cx:(PX(780)+PX(1040))/2|0,cz:(PZ(1420)+PZ(1500))/2|0,ang:0,
    hl:(PX(1040)-PX(780))/2|0,hw:(PZ(1500)-PZ(1420))/2|0,h:24,roof:'gable',arches:true});
  hall({cx:(PX(1040)+PX(1120))/2|0,cz:(PZ(1235)+PZ(1420))/2|0,ang:0,
    hl:(PX(1120)-PX(1040))/2|0,hw:(PZ(1420)-PZ(1235))/2|0,h:26,roof:'gable'});
  { const X0=PX(790),X1=PX(1030),Z0=PZ(1275),Z1=PZ(1410);
    paveRect(X0,Z0,X1,Z1,MAT.PATH,0.0);
    fountain((X0+X1)/2|0,PZ(1340));
    for(const [lx,ly] of [[820,1290],[1000,1290],[820,1400],[1000,1400]]) lamp(PX(lx),PZ(ly),4);
  }
  roundTower({x:PX(775),z:PZ(1182),r:Math.round(42*S*10)/10,h:32});
  roundTower({x:PX(775),z:PZ(1495),r:Math.round(42*S*10)/10,h:30});
  roundTower({x:PX(1105),z:PZ(1235),r:Math.round(45*S*10)/10,h:34});
  roundTower({x:PX(1000),z:PZ(1168),r:2.4,h:20,coneH:7});
  roundTower({x:PX(1065),z:PZ(1168),r:2.4,h:22,coneH:7});
  roundTower({x:PX(1060),z:PZ(1545),r:2.4,h:20,coneH:7});
  { /* clock tower + faces */
    const cx=PX(795),cz=PZ(1340);
    squareTower({x:cx,z:cz,s:5,h:44,roofH:18,pinnacle:true,win:'normal'});
    const cy=PLAT_Y+36;
    for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){
      if(dx*dx+dz*dz<=10){
        const rim=dx*dx+dz*dz>8;
        set(cx-6,cy+dz,cz+dx, rim?MAT.GOLD:MAT.CLOCK);
        set(cx+6,cy+dz,cz+dx, rim?MAT.GOLD:MAT.CLOCK);
      }
    }
    for(let k=0;k<3;k++){ set(cx-6,cy,k?cz:cz+k,MAT.BLACK); set(cx+6,cy+k,cz,MAT.BLACK); }
    castleLights.push({x:cx,y:cy,z:cz,i:0.9});
  }
  { /* astronomy tower — tallest point */
    const ax=PX(1100),az=PZ(1490);
    roundTower({x:ax,z:az,r:10,h:44,machi:2,coneH:42,spire:5,winN:18,litP:0.65});
    roundTower({x:ax-6,z:az-5,r:2.2,h:10,y0:PLAT_Y+38,coneH:8});
    roundTower({x:ax-4,z:az-8,r:2.0,h:12,y0:PLAT_Y+42,coneH:7});
    castleLights.push({x:ax,y:PLAT_Y+50,z:az,i:1.2});
  }

  /* ---------- clock-tower courtyard (W) & wooden bridge ---------- */
  hall({cx:(PX(595)+PX(700))/2|0,cz:(PZ(1255)+PZ(1420))/2|0,ang:0,
    hl:(PX(700)-PX(595))/2|0,hw:(PZ(1420)-PZ(1255))/2|0,h:22,roof:'gable',dormers:true});
  { const X0=PX(425),X1=PX(782),Z0=PZ(1250),Z1=PZ(1425);
    const cy=PLAT_Y;
    for(let x=X0;x<=X1;x++){ for(const z of [Z0,Z1]){
      const t=Math.max(topAt(x,z),cy);
      for(let k=1;k<=9;k++) set(x,t+k,z,MAT.STONE2);
      if((x+z)%2===0){set(x,t+10,z,MAT.STONE3);set(x,t+11,z,MAT.STONE3);} } }
    for(let z=Z0;z<=Z1;z++){
      let t=Math.max(topAt(X0,z),cy);
      const gate=(z>PZ(1312)&&z<PZ(1352));          // gate opening in the west wall
      for(let k=1;k<=11;k++) if(!gate||k>6) set(X0,t+k,z,MAT.STONE2);
      if((X0+z)%2===0&&!gate){set(X0,t+12,z,MAT.STONE3);set(X0,t+13,z,MAT.STONE3);}
    }
    roundTower({x:PX(425),z:PZ(1262),r:2.6,h:12,coneH:8,y0:cy,litP:0.4});
    roundTower({x:PX(425),z:PZ(1412),r:2.6,h:12,coneH:8,y0:cy,litP:0.4});
    paveRect(PX(440),PZ(1270),PX(760),PZ(1410),MAT.PATH,0.05);
    fountain(PX(525),PZ(1338));
  }
  bridge({x0:PX(700),z0:PZ(1340),x1:PX(782),z1:PZ(1340),y:PLAT_Y,w:3,covered:true});
  bridge({x0:PX(422),z0:PZ(1340),x1:PX(240),z1:PZ(1340),y:BASE_Y+24,w:3,truss:true,lanternEvery:12,covered:true,deck:MAT.WOOD2});
  { const gx=PX(232),gz=PZ(1340);
    roundTower({x:gx,z:gz,r:2.5,h:8,coneH:8,y0:BASE_Y+24,litP:0.8}); }

  /* ---------- Great Hall (oriented −34.9°) ---------- */
  { const cx=PX(1125),cz=PZ(1655),ang=-34.9*Math.PI/180;
    hall({cx,cz,ang,hl:24,hw:5,y0:PLAT_Y,h:28,roof:'gable',roofH:10,win:'gothic',
      buttress:3,litP:0.9/0.72,winKind:MAT.WIN2,trim:MAT.STONE3});
    paveOrient(cx,cz,ang,27,8,MAT.PATH);
    roundTower({x:cx+Math.round(Math.cos(ang)*8-Math.sin(ang)*8),z:cz+Math.round(Math.sin(ang)*8+Math.cos(ang)*8),
      r:3,h:34,y0:PLAT_Y,coneH:10,winN:5,litP:0.8});
    const [fx,fz]=toWorld(cx,cz,ang,0,0);
    for(let k=0;k<3;k++) set(fx,PLAT_Y+28+10+k,fz,k===2?MAT.COPPER:MAT.ROOF2);
    castleLights.push({x:fx,y:PLAT_Y+16,z:fz,i:2.2});
  }

  /* ---------- bridges & stairs ---------- */
  bridge({x0:PX(1340),z0:PZ(1170),x1:PX(1250),z1:PZ(1465),y:PLAT_Y,w:3,lanternEvery:6,pierEvery:8});
  bridge({x0:PX(1145),z0:PZ(1215),x1:PX(1205),z1:PZ(1160),y:PLAT_Y+12,w:3,covered:true});
  { const pts=[[1330,1590],[1370,1690],[1470,1700],[1500,1630],[1600,1600],[1690,1600],[1760,1650]]
      .map(p=>[PX(p[0]),PZ(p[1])]);
    stairPath(pts,PLAT_Y,LAKE_Y+2,1,5); }

  /* ---------- boathouse ---------- */
  { const cx=PX(1805),cz=PZ(1700), y0=LAKE_Y+3;
    hall({cx,cz,ang:Math.PI/2,hl:3,hw:6,y0,h:8,roof:'gable',roofH:5,win:'normal',litP:0.8,stone:MAT.WOOD2,trim:MAT.WOOD});
    roundTower({x:cx+2,z:cz-7,r:2.2,h:10,y0,coneH:8,litP:0.9,stone:MAT.PALEST});
    for(const v of [-4,4]){
      const z=cz+v;
      for(let i=0;i<10;i++){ set(cx-8-i,y0-1,z,MAT.WOOD); if(i%4===0){set(cx-8-i,y0,z,MAT.IRON);set(cx-8-i,y0+1,z,MAT.LANT);} }
    }
    castleLights.push({x:cx,y:y0+4,z:cz,i:1.2});
  }
}
