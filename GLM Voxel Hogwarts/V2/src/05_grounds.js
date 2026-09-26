/* ════════════════════════════════════════════════════════════════════
   05_grounds.js — Quidditch pitch, Hagrid's hut, stone circle, willow,
   forest, boats, squid, Hogwarts Express & Hogsmeade station
   ════════════════════════════════════════════════════════════════════ */

/* flat low eastern tier for the railway */
function levelStationTier() {
  for (let z = 58; z <= 132; z++) for (let x = 229; x <= 247; x++) {
    let t = surfY(x, z);
    if (t < LAKE_Y - 1) continue;                       /* leave water alone */
    const watery = get(x, LAKE_Y, z) === WATER || get(x, LAKE_Y - 1, z) === WATER;
    if (watery) continue;
    while (t > 66) { set(x, t, z, 0); t--; }
    while (t < 66) { t++; const m = t === 66 ? GRASS : (hash(x, t, z, 55) < 0.4 ? ROCK : DIRT); set(x, t, z, m); }
    set(x, 66, z, hash(x, 0, z, 56) < 0.5 ? GRASS : GRASS2);
  }
}

/* ── Quidditch pitch on the grounds tier ── */
function quidditchPitch() {
  const cx = PX(800), cz = PZ(330), y = surfY(cx, cz);
  if (y <= LAKE_Y + 1) return;
  const ang = -16 * DR, ca = Math.cos(ang), sa = Math.sin(ang);
  const a = 24, b = 13;
  const ev = (x, z) => {                                /* rotated ellipse norm */
    const dx = x - cx, dz = z - cz;
    const u = dx * ca + dz * sa, v = -dx * sa + dz * ca;
    return (u / a) * (u / a) + (v / b) * (v / b);
  };
  const r = Math.ceil(a) + 2;
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const x = cx + dx, z = cz + dz, e = ev(x, z);
    if (e > 1.55) continue;
    const t = surfY(x, z);
    if (e <= 1) {
      const stripe = ((Math.round(-dx * sa + dz * ca) + 200) % 6 < 3);
      set(x, t, z, stripe ? GRASS : MOSS);
    } else if (e <= 1.14) set(x, t, z, SAND);
    else set(x, t, z, hash(x, t, z, 61) < 0.5 ? GRAVEL : GRASS2);
  }
  /* centre circle */
  for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
    const d = Math.hypot(dx, dz);
    if (d >= 3.6 && d <= 4.6 && ev(cx + dx, cz + dz) < 1) { const t = surfY(cx + dx, cz + dz); set(cx + dx, t, cz + dz, SAND); }
  }
  /* 3 gold hoops per end: heights 9 / 12 / 9, ring r2 */
  for (const end of [1, -1]) {
    const hx = cx + end * (a - 3) * ca, hz = cz + end * (a - 3) * sa;
    const mx = -sa * end, mz = ca * end;                /* across the pitch */
    [4, 0, -4].forEach((off, k) => {
      const px = Math.round(hx + mx * off), pz = Math.round(hz + mz * off);
      const hgt = (off === 0 ? 12 : 9), t = surfY(px, pz);
      for (let u = 1; u <= hgt; u++) set(px, t + u, pz, GOLD);
      const cy = t + hgt + 2;
      for (let s2 = 0; s2 < 14; s2++) {
        const p2 = s2 / 14 * Math.PI * 2;
        const rx = Math.round(px + mx * Math.cos(p2) * 2);
        const rz = Math.round(pz + mz * Math.cos(p2) * 2);
        const ry = Math.round(cy + Math.sin(p2) * 2);
        set(rx, ry, rz, GOLD);
      }
    });
  }
  /* 10 stand towers in rotating house colours + bleachers */
  const HOUSES = [RED, GREENH, BLUEH, YELL];
  for (let k = 0; k < 10; k++) {
    const p = k / 10 * Math.PI * 2 + 0.31;
    const ru = Math.cos(p), rv = Math.sin(p);
    const dirx = ca * ru - sa * rv, dirz = sa * ru + ca * rv;
    for (let row = 0; row < 3; row++) {
      const m = 1.22 + row * 0.16;
      const n = 14;
      for (let s2 = 0; s2 <= n; s2++) {
        const t2 = p - 0.5 + s2 / n;                     /* arc around the pitch */
        const eA = Math.cos(t2), eB = Math.sin(t2);
        const orx = (a * m + row) * eA, orz = (b * m + row * 1.2) * eB;
        const x = Math.round(cx + ca * orx - sa * orz), z = Math.round(cz + sa * orx + ca * orz);
        const t = surfY(x, z);
        set(x, t + 1 + row, z, row === 0 ? WOOD2 : WOOD);
      }
    }
    /* tower at the arc centre */
    const tx = Math.round(cx + ca * (a + 8) * ru - sa * (b + 8) * rv);
    const tz = Math.round(cz + sa * (a + 8) * ru + ca * (b + 8) * rv);
    const tt = surfY(tx, tz);
    const hc = HOUSES[k % 4];
    for (let y = 1; y <= 8; y++) fillDisk(tx, tz, tt + y, 2.1, hc);
    for (let k2 = 0; k2 < 3; k2++) {                      /* pyramid cap */
      const yy = tt + 9 + k2, r4 = 2.4 - k2 * 0.85;
      fillDisk(tx, tz, yy, r4, k2 === 2 ? STONE3 : ROOF);
    }
    set(tx, tt + 12, tz, GOLD);
  }
}

/* ── Hagrid's hut ── */
function hagridHut() {
  const x = 50, z = 190, t = surfY(x, z);
  if (t <= LAKE_Y + 1) return;
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    const d = Math.hypot(dx, dz);
    if (d <= 4.2) {
      for (let y = 1; y <= 5; y++) set(x + dx, t + y, z + dz, y === 1 ? STONE2 : PALEST);
    }
  }
  /* solid stepped thatch cone */
  for (let k = 0; k < 6; k++) {
    const r4 = 4.6 - k * 0.72;
    if (r4 <= 0.4) break;
    fillDisk(x, z, t + 5 + k, r4, k > 3 ? WOOD : WOOD2);
  }
  set(x, t + 1, z + 4, 0); set(x, t + 2, z + 4, 0);      /* door (south) */
  set(x - 3, t + 3, z - 1, WIN); set(x + 3, t + 3, z + 2, WIN);
  for (let k = 0; k < 4; k++) set(x - 2, t + 4 + k, z - 3, STONE2);   /* chimney */
  /* 3×3 pumpkin patch + fence + lamp */
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
    set(x + 5 + dx, surfY(x + 5 + dx, z + 6 + dz) + 1, z + 6 + dz, PUMPK);
  for (let k = 0; k < 22; k++) {
    const p2 = k / 22 * Math.PI * 2;
    const fx = Math.round(x + Math.cos(p2) * 8), fz = Math.round(z + Math.sin(p2) * 8);
    const ft = surfY(fx, fz);
    if (ft <= LAKE_Y + 1) continue;
    set(fx, ft + 1, fz, WOOD);
    if (k % 2 === 0) set(fx, ft + 2, fz, WOOD);
  }
  lampPost(x + 5, z - 5, surfY(x + 5, z - 5));
  addLight(x, t + 7, z + 4, 0.9);
}

/* ── stone circle ── */
function stoneCircle() {
  const x = 30, z = 160, t = surfY(x, z);
  for (let k = 0; k < 11; k++) {
    const p2 = k / 11 * Math.PI * 2;
    const sx = Math.round(x + Math.cos(p2) * 6), sz = Math.round(z + Math.sin(p2) * 6);
    const st = surfY(sx, sz);
    const hh = 4 + Math.floor(hash(sx, 0, sz, 141) * 3);
    for (let y = 1; y <= hh; y++) set(sx, st + y, sz, hash(sx, y, sz, 142) < 0.3 ? STONE2 : PALEST);
  }
  set(x, t, z, MOSS);
}

/* ── Whomping Willow ── */
function whompingWillow() {
  const x = 72, z = 150, t = surfY(x, z);
  for (let y = 1; y <= 7; y++) { fillBox(x, t + y, z, x + 1, t + y, z + 1, TRUNK); }
  for (let bI = 0; bI < 9; bI++) {
    const th = bI / 9 * Math.PI * 2 + hash(bI, 0, 0, 151);
    const len = 5 + Math.floor(hash(bI, 1, 0, 151) * 3);
    let px2 = x + 0.5, py2 = t + 7, pz2 = z + 0.5;
    for (let k = 0; k < len; k++) {
      px2 += Math.cos(th) * 0.8; pz2 += Math.sin(th) * 0.8;
      py2 += (k < 2 ? 1.1 : k > 3 ? -1.2 : 0.25);
      set(Math.round(px2), Math.round(py2), Math.round(pz2), WOOD);
      if (hash(bI, k, 0, 151) < 0.3) set(Math.round(px2), Math.round(py2) + 1, Math.round(pz2), WOOD);
      if (k === len - 1) {                                  /* drooping leaves */
        for (let d2 = 0; d2 < 5; d2++) {
          const lx = Math.round(px2) + (hash(bI, d2, 1, 151) * 3 - 1.5 | 0);
          const lz = Math.round(pz2) + (hash(bI, d2, 2, 151) * 3 - 1.5 | 0);
          const ly = Math.round(py2) - 1 - (hash(bI, d2, 3, 151) * 2 | 0);
          set(lx, ly, lz, hash(bI, d2, 4, 151) < 0.5 ? LEAF : LEAF2);
        }
      }
    }
  }
}

/* ── boats on the lake ── */
function buildBoats() {
  const spots = [];
  for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
    spots.push([
      168 + i * 9 + (row ? 5 : 0) + Math.floor(rnd() * 3),
      238 + row * 7 + Math.floor(rnd() * 3)
    ]);
  }
  for (const [bx, bz] of spots) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) === 2 && Math.abs(dz) === 1) continue;   /* taper bow */
      set(bx + dx, LAKE_Y - 1, bz + dz, WOOD);                 /* hull floor */
      const rim = (Math.abs(dx) === 2 || Math.abs(dz) === 1);
      if (rim) { set(bx + dx, LAKE_Y, bz + dz, WOOD2); set(bx + dx, LAKE_Y + 1, bz + dz, WOOD2); }
    }
    set(bx - 2, LAKE_Y + 2, bz, CANDLE);                       /* boat candle */
  }
}

/* ── giant squid ── */
function giantSquid() {
  const cx2 = 192, cz2 = 234;
  for (let k = 0; k < 4; k++) {
    const th = k / 4 * Math.PI * 2 + 0.6;
    let px2 = cx2 + Math.cos(th) * 2, pz2 = cz2 + Math.sin(th) * 2;
    const arc = [0, 3, 6, 8, 9, 8, 7, 6, 4, 2];
    for (let s2 = 0; s2 < arc.length; s2++) {
      px2 += Math.cos(th) * 0.9; pz2 += Math.sin(th) * 0.9 + (s2 > 4 ? 0.4 : 0);
      const y = LAKE_Y + arc[s2] - 1;
      fillDisk(Math.round(px2), Math.round(pz2), y, 1.1, SQUID);
    }
  }
  fillDisk(cx2, cz2, LAKE_Y, 2.2, SQUID); fillDisk(cx2, cz2, LAKE_Y + 1, 1.6, SQUID);
}

/* ── Hogwarts Express & Hogsmeade station ── */
function hogwartsExpress() {
  /* track bed + sleepers + rails (x-centre 236, z 60..130) */
  for (let z = 60; z <= 130; z++) {
    for (let x = 233; x <= 239; x++) set(x, 66, z, GRAVEL);
    if (z % 2 === 0) for (let x = 234; x <= 238; x++) set(x, 67, z, WOOD);
    set(235, 67, z, IRON); set(237, 67, z, IRON);
  }
  /* platform (east) */
  for (let z = 62; z <= 128; z++) for (let x = 240; x <= 243; x++) {
    set(x, 67, z, STONE3); set(x, 68, z, STONE3);
    for (let y = 65; y <= 66; y++) set(x, y, z, y === 66 ? PATH : ROCK);
  }
  for (let z = 64; z <= 127; z += 9) { set(242, 69, z, IRON); set(242, 70, z, LANT); }
  /* station house: walls + full two-step roof sitting on the walls */
  for (let z = 74; z <= 92; z++) for (let x = 245; x <= 250; x++) {
    const ed = x === 245 || x === 250 || z === 74 || z === 92;
    if (ed) {
      for (let y = 69; y <= 73; y++) set(x, y, z, y < 71 ? WOOD : WOOD2);
      for (let y = 68; y > 60; y--) { if (get(x, y, z)) break; set(x, y, z, STONE2); }
    }
    const dx2 = Math.min(x - 245, 250 - x);
    set(x, 74, z, WOOD2);                               /* eave row on wall top */
    if (dx2 === 2) set(x, 75, z, ROOF2);                /* ridge along the house */
  }
  for (const zz of [76, 80, 84, 88]) { set(245, 71, zz, WIN); set(250, 71, zz, WIN); }
  set(250, 70, 83, 0); set(250, 71, 83, 0); set(250, 72, 83, WOOD2); set(245, 69, 83, LANT);
  /* ── the train itself ── */
  const X0 = 233, X1 = 239;
  /* engine boiler (front = z-) : z 112..124 */
  for (let z = 112; z <= 124; z++) for (let x = X0 + 1; x <= X1 - 1; x++) {
    set(x, 69, z, TRAINR);                                 /* red skirt */
    for (let y = 70; y <= 73; y++) set(x, y, z, BLACK);
  }
  for (let y = 70; y <= 75; y++) set(236, y, 113, BLACK);   /* chimney */
  set(236, 76, 113, IRON);
  fillBox(234, 74, 115, 238, 74, 117, IRON);
  set(236, 70, 111, LANT);                                  /* headlamp */
  /* cab */
  for (let z = 104; z <= 111; z++) for (let x = X0; x <= X1; x++) {
    const ed = x === X0 || x === X1;
    if (ed) for (let y = 69; y <= 75; y++) set(x, y, z, TRAINR);
  }
  fillBox(233, 76, 103, 239, 76, 112, BLACK);               /* cab roof */
  for (const zz of [105, 107, 109]) { set(233, 71, zz, WIN); set(233, 72, zz, WIN); set(239, 71, zz, WIN); set(239, 72, zz, WIN); }
  /* tender */
  for (let z = 96; z <= 101; z++) for (let x = X0 + 1; x <= X1 - 1; x++) {
    for (let y = 69; y <= 72; y++) set(x, y, z, BLACK);
  }
  fillBox(234, 73, 95, 238, 73, 102, TRAINR);
  for (let x = 234; x <= 238; x++) for (let z = 95; z <= 102; z++) { set(x, 68, z, IRON); set(x, 68, z, z % 3 === 0 ? WOOD2 : IRON); }
  /* three red carriages */
  for (let c2 = 0; c2 < 3; c2++) {
    const zA = 66 + c2 * 10, zB = zA + 8;
    for (let z = zA; z <= zB; z++) for (let x = X0 + 1; x <= X1 - 1; x++) {
      for (let y = 69; y <= 72; y++) set(x, y, z, TRAINR);
    }
    fillBox(233, 73, zA - 1, 239, 73, zB + 1, BLACK);
    for (let z = zA + 1; z <= zB - 1; z += 3)
      for (let y = 70; y <= 71; y++) { set(233, y, z, WIN); set(239, y, z, WIN); }
    for (let x = 234; x <= 238; x++) for (let z = zA - 1; z <= zB + 1; z++) {
      set(x, 68, z, IRON);
      if (z % 2 === 0) set(x, 68, z, WOOD2);
    }
  }
  addLight(242, 71, 84, 0.9);
}

/* ── trees ── */
function plantPine(x, z, t) {
  const th = 2 + Math.floor(hash(x, 0, z, 151) * 2);
  for (let y = 1; y <= th; y++) set(x, t + y, z, TRUNK);
  let yy = t + th + 1;
  const rings = [3, 2, 3, 2, 1];
  for (let rI = 0; rI < rings.length - 1; rI++) {
    for (let k = 0; k < 2; k++) {
      fillDisk(x, z, yy++, rings[rI] - k * 0.7 + 0.4,
               hash(x, yy, z, 161) < 0.5 ? LEAF2 : LEAF3);
    }
  }
  fillDisk(x, z, yy, 0.7, LEAF3);
}

function plantOak(x, z, t) {
  const th = 3 + Math.floor(hash(x, 0, z, 151) * 3);
  for (let y = 1; y <= th; y++) set(x, t + y, z, TRUNK);
  const rx = 2.6 + hash(x, 1, z, 151) * 1.6, ry = 2.2 + hash(x, 2, z, 151), rz = 2.6 + hash(x, 3, z, 151) * 1.6;
  const cy = t + th + ry;
  for (let dz = -4; dz <= 4; dz++) for (let dy = -3; dy <= 3; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const e = (dx / rx) ** 2 + (dy / ry) ** 2 + (dz / rz) ** 2;
      /* solid core + noisy edge shell — no interior holes */
      if (e <= 0.72 ||
          (e <= 1.06 && hash(x + dx, dy, z + dz, 171) < 0.78 - (e - 0.72) * 0.9))
        set(x + dx, Math.round(cy) + dy, z + dz,
            hash(x + dx, dy, z + dz, 172) < 0.3 ? LEAF2 : (hash(x, dy, z, 173) < 0.28 ? LEAF3 : LEAF));
    }
}

/* ── keep-clear zones ── */
function clearOf(x, z) {
  const dpx = x - PX(800), dpz = z - PZ(330);              /* pitch */
  if ((dpx / 33) ** 2 + (dpz / 22) ** 2 <= 1) return false;
  if (Math.hypot(x - 50, z - 190) < 17) return false;      /* hut */
  if (Math.hypot(x - 30, z - 160) < 15) return false;      /* circle */
  if (Math.hypot(x - 72, z - 150) < 10) return false;      /* willow */
  if (x > 222 && z > 54 && z < 136) return false;          /* station */
  return true;
}

function forbiddenForest() {
  const occ = new Uint8Array(W * D);   /* coarse-cell occupancy for spacing */
  const forZone = (x, z) => (x < 100 && z < 210) || (z < 92 && x < 152) || (z > 170 && x < 128);
  for (let n = 0; n < 9000; n++) {
    const x = 4 + Math.floor(rnd() * (W - 10)), z = 4 + Math.floor(rnd() * (D - 10));
    if (!clearOf(x, z)) continue;
    const t = surfY(x, z);
    if (t <= LAKE_Y + 1) continue;                        /* water / beach */
    if (t >= 94) continue;                                /* castle plateau stays bare */
    const zone = forZone(x, z);
    let den;
    if (zone) den = fbm(x * 0.05, z * 0.05, 3, 303) > 0.33 ? 0.9 : 0.25;
    else den = t < GROUND2 ? 0.06 : 0.015;                /* sparse elsewhere */
    if (rnd() > den) continue;
    const gp = zone ? 3 : 4;                              /* occupancy spacing */
    const oi = Math.floor(x / gp) + W * Math.floor(z / gp);
    if (occ[oi]) continue;
    /* avoid buildings & cliffs */
    if (get(x, t + 2, z)) continue;
    if (Math.abs(surfY(x + 1, z) - t) > 2 || Math.abs(surfY(x, z + 1) - t) > 2) continue;
    if (x < 3 || z < 3 || x > W - 4 || z > D - 4) continue;
    if (hash(x, 0, z, 181) < 0.55) plantPine(x, z, t); else plantOak(x, z, t);
    occ[oi] = 1;
  }
}

function cliffBushes() {
  for (let z = 2; z < D - 2; z++) for (let x = 2; x < W - 2; x++) {
    const t = surfY(x, z), m = get(x, t, z);
    const rocky = (m === ROCK || m === ROCK2);
    const grassy = (m === GRASS || m === GRASS2) && t < GROUND2 && t > BASE_Y;
    if (!rocky && !grassy) continue;
    if (!clearOf(x, z)) continue;                         /* pitch, hut, circle… stay bare */
    const p2 = rocky ? 0.11 : 0.03;
    if (hash(x, 2, z, 191) > p2) continue;
    for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (hash(x + dx, dy, z + dz, 192) < 0.72)
          set(x + dx, t + 1 + dy, z + dz, hash(x, dy, z, 193) < 0.5 ? LEAF2 : (hash(x, dy, z, 194) < 0.4 ? LEAF3 : LEAF));
  }
}

function buildGrounds() {
  levelStationTier();
  quidditchPitch();
  hagridHut();
  stoneCircle();
  whompingWillow();
  /* gravel paths: bridge → circle → Hagrid, gatehouse → lake */
  pathLine(40, 175, 30, 162, GRAVEL);
  pathLine(30, 162, 44, 186, GRAVEL);
  pathLine(79, 131, 92, 150, GRAVEL);
  pathLine(92, 150, 97, 168, GRAVEL);
  forbiddenForest();
  cliffBushes();
  buildBoats();
  giantSquid();
  hogwartsExpress();
}
