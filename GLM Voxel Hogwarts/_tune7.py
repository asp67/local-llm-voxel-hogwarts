# -*- coding: utf-8 -*-
import io
p = "index.html"
s = io.open(p, encoding='utf-8').read()

def rep(old, new):
    global s
    if old not in s:
        print("MISS:", old[:70].replace('\n', '\\n'))
        return
    s = s.replace(old, new, 1)
    print("ok  :", old[:56].replace('\n', '\\n'))

# 1) the lawn sits on its own raised crag (hill 1 of the plan's three)
rep("""function topAt(x,z){
  const dn=dnAt(x,z);
  if(dn<=58) return 64;""",
    """function topAt(x,z){
  const dn=dnAt(x,z);
  if(x>=-21&&x<=0&&z<=-35&&z>=-59) return 66;    // the bowling-green's own crag, two over the courts
  if(dn<=58) return 64;""")

# 2) re-ground the whole lawn block onto the crag (66), with a stone access stair down to 64
OLD_LAWN = None
i0 = s.index("  /* ===== great bowling-green lawn walled to the crag rim (\"lawn sloping down\") ===== */")
i1 = s.index("  /* ===== straight lattice bridge west to the garden fort ===== */")
NEW_LAWN = '''  /* ===== great bowling-green lawn on its own crag ("lawn sloping down") ===== */
  for(let x=-19;x<=-1;x++){
    for(let y=66;y<=70;y++){ setV(x,y,-55, jit(C.chalk,.06)); setV(x,y,-56, jit(C.chalk2,.06)); }
    if((x&1)===0) setV(x,71,-55, jit(C.chalk2,.06));
  }
  for(let z=-55;z<=-36;z++){
    for(let y=66;y<=70;y++){ setV(-19,y,z, jit(C.chalk,.06)); setV(-18,y,z, jit(C.chalk2,.06)); }
    if((z&1)===0) setV(-19,71,z, jit(C.chalk2,.06));
  }
  for(let x=-19;x<=-2;x++){
    if(x>=-8&&x<=-5) continue;
    for(let y=66;y<=70;y++) setV(x,y,-35, jit(C.chalk,.06));
    if((x&1)===0) setV(x,71,-35, jit(C.chalk2,.06));
  }
  for(let z=-36;z<=-54;z++){                          // low wall facing the viaduct walk
    if(z>=-43&&z<=-41) continue;
    for(let y=66;y<=67;y++) setV(-1,y,z, jit(C.chalk2,.06));
  }
  fillBox(-17,66,-53, -2,66,-36, C.grass,{j:.06});    // the lawn, mown high on its crag
  for(const tz of [-47,-41])
    for(let x=-17;x<=-2;x++) setV(x,66,tz, jit(C.chalk2,.07));
  for(let i=0;i<26;i++){
    const x=(-16+(rnd()*14|0)), z=(-52+(rnd()*16|0));
    if(x>=-9&&x<=-4&&z>=-45) continue;
    if(vnoise(x*.5,z*.5)>.62) setV(x,67,z, jit(C.pine,.12));
  }
  /* stone access: the crag steps down its south face to the court level */
  for(let x=-9;x<=-4;x++) setV(x,65,-34, jit(C.chalk2,.07));
  for(let x=-10;x<=-3;x++) for(let z=-33;z<=-30;z++) setV(x,64,z, jit(C.path,.07));
  for(const [tx,tz,tb] of [[-19,-33,64],[-3,-33,64],[-21,-44,66]]){   // buttress turrets on their own ground
    fillCyl(tx,tz,tb,tb+5,1.6,C.chalk2,{j:.05});
    cone(tx,tz,tb+6,1.8,C.chalk2,{ls:2,dec:.7});
  }

'''
s = s[:i0] + NEW_LAWN + s[i1:]
print("ok  : lawn block re-ground to the crag")

# 3) spurs: terraced, textured rock columns - never a flat black slab, never above the crater rim
OLD_SPUR = s[s.index("  /* crag buttress spurs: eroded lobes where the plan's contours bunch */"):s.index("function buildCastle()")]
NEW_SPUR = """  /* crag buttress spurs: terraced rocky knolls where the plan's contours bunch */
  for(const [ang,sTop,sR] of [[0.35,56,8],[0.95,58,9],[1.55,56,7],[2.2,58,10],[2.8,57,9],[-0.5,56,8],[-2.45,58,9],[-1.24,55,7]]){
    const base=pointOnDN(ang,66);
    const lobes=[[0,0,sR],[Math.round(rnd()*8-4),Math.round(rnd()*8-4),sR*(0.55+rnd()*0.25)]];
    for(const [ox,oz,r0] of lobes){
      const R=Math.ceil(r0*1.3);
      for(let dx=-R;dx<=R;dx++)for(let dz=-R;dz<=R;dz++){
        const rr=(dx*dx+dz*dz)/(r0*r0);
        if(rr>1.3) continue;
        const x=base.x+ox+dx, z=base.z+oz+dz, dn=dnAt(x,z);
        if(dn<57||dn>78) continue;
        const t0=topAt(x,z); if(t0>sTop) continue;
        const top=sTop-Math.max(0,rr-0.5)*5;
        const u=underAt(x,z), yb=Math.max(u+1,36), yt=Math.max(yb,Math.min(top,t0));
        for(let y=yb;y<=yt;y++){
          let c;
          if(y===yt)       c = vnoise(x*.4,z*.4)>.55 ? C.grass2 : C.rock;
          else if(y>=yt-2) c = mul(vnoise(x*.4,z*.4)>.5?C.grass2:C.rock, 0.85);
          else {
            const f=Math.min(1,(yt-y)/20);
            c = (y%3===0) ? mixC(C.rock,C.rock2,0.5) : mixC(C.rock,C.deep,f);
          }
          setV(x,y,z, jit(c,.06));
        }
      }
    }
  }
}

"""
s = s.replace(OLD_SPUR, NEW_SPUR, 1)
print("ok  : spurs rebuilt as terraced, textured crags")

# 4) seat the three lead bulbs on the boathouse roof, not in the air
rep("bulb(-29,71,66,1.7,C.lead); bulb(-24,72,66,1.7,C.lead); bulb(-19,71,66,1.7,C.lead);",
    "bulb(-29,71,58,1.7,C.lead); bulb(-24,72,61,1.7,C.lead); bulb(-19,71,58,1.7,C.lead);")

# 5) the hall-to-hall join: carved trench no longer guts the roof; proper arched entry instead
rep("windingPath([[-20,28],[-21,36],[-21,46],[-21,56]],{wob:1,lad:8});",
    "windingPath([[-20,28],[-20,38],[-20,47],[-20,53]],{wob:1,lad:8});")
rep("""  windingPath([[-28,52],[-28,58]],{wob:0});""",
    """  for(let y=47;y<=50;y++) delV(-20,y,56);            // arch into the lower hall
  winGlow(-20,48,57); winGlow(-20,49,57);""")

# 6) the jetty gets its own rock islet (second island of the plan)
rep("fillBox(59,44,56, 67,45,63, C.wood,{j:.08});                    // jetty over the open loch",
    "isletPillar(63,60,40);                                          // the jetty's own rock islet\n  fillBox(59,44,56, 67,45,63, C.wood,{j:.08});                    // jetty deck on the islet")

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print("written bytes:", len(s))
