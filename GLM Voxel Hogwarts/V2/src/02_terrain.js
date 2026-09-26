/* ════════════════════════════════════════════════════════════════════
   02_terrain.js — the multi-tiered floating island
   ════════════════════════════════════════════════════════════════════ */

const INF = 1 << 24;

/* two-pass chamfer distance transform (1, √2 ≈ 3, 4.24/3) over a 288×288 mask */
function chamfer(mask) {
  const d = new Int32Array(W * D);
  for (let i = 0; i < W * D; i++) d[i] = mask[i] ? 0 : INF;
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const i = x + W * z; let v = d[i];
    if (v === 0) continue;
    if (x > 0)               { const t = d[i - 1] + 3;     if (t < v) v = t; }
    if (z > 0)               { const t = d[i - W] + 3;     if (t < v) v = t; }
    if (x > 0 && z > 0)      { const t = d[i - 1 - W] + 4; if (t < v) v = t; }
    if (x < W - 1 && z > 0)  { const t = d[i + 1 - W] + 4; if (t < v) v = t; }
    d[i] = v;
  }
  for (let z = D - 1; z >= 0; z--) for (let x = W - 1; x >= 0; x--) {
    const i = x + W * z; let v = d[i];
    if (v === 0) continue;
    if (x < W - 1)           { const t = d[i + 1] + 3;     if (t < v) v = t; }
    if (z < D - 1)           { const t = d[i + W] + 3;     if (t < v) v = t; }
    if (x < W - 1 && z < D - 1) { const t = d[i + 1 + W] + 4; if (t < v) v = t; }
    if (x > 0 && z < D - 1)     { const t = d[i - 1 + W] + 4; if (t < v) v = t; }
    d[i] = v;
  }
  return d;
}

function buildTerrain() {
  const F  = (x, z) => fbm(x * 0.028, z * 0.028, 4, 101);   /* broad swell */
  const F2 = (x, z) => fbm(x * 0.11,  z * 0.11,  3, 202);   /* cliff detail */

  /* rim radius: jittered ±2.5 by angular noise */
  const edge = new Float32Array(W * D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const dx = x - CX, dz = z - CZ, d = Math.hypot(dx, dz), i = x + W * z;
    if (d < R - 14) edge[i] = R;
    else {
      const th = Math.atan2(dz, dx);
      edge[i] = R + (vnoise(Math.cos(th) * 4 + 70, Math.sin(th) * 4 + 70, 707) - 0.5) * 5;
    }
  }

  /* ── region masks, written in plan-pixel space ── */
  const mC = new Uint8Array(W * D), mG = new Uint8Array(W * D);
  const CRECTS = [
    [1110, 430, 1590, 1035], [945, 585, 1285, 925], [1265, 570, 1435, 1150],
    [1185, 1025, 1515, 1185], [875, 900, 1095, 1100], [1090, 900, 1225, 1030],
    [1025, 365, 1185, 600], [755, 1160, 1135, 1515], [405, 1240, 715, 1435]
  ];
  const ORIENTS = [        /* cx, cz (plan), angle°, halfLen px, halfWid px */
    [835, 640, -22, 150, 95], [890, 700, 19, 125, 55], [1125, 1655, -34.9, 240, 95]
  ];
  const CIRCLES = [[1100, 1490, 115], [1330, 1600, 45]];
  const GPOLY = [
    [1110, 360], [1000, 175], [890, 125], [660, 135], [520, 330],
    [470, 420], [560, 520], [720, 520], [950, 560], [1070, 560]
  ];
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const px = 1100 + (x - CX) / S, pz = 1080 + (z - CZ) / S, i = x + W * z;
    for (const [a, b, c, d] of CRECTS)
      if (px >= a && px <= c && pz >= b && pz <= d) { mC[i] = 1; break; }
    if (!mC[i]) for (const [ox, oz, ang, hl, hw] of ORIENTS) {
      const a = ang * DR, ca = Math.cos(a), sa = Math.sin(a);
      const dx = px - ox, dz = pz - oz;
      const u = dx * ca + dz * sa, v = -dx * sa + dz * ca;
      if (u >= -hl && u <= hl && v >= -hw && v <= hw) { mC[i] = 1; break; }
    }
    if (!mC[i]) for (const [ox, oz, pr] of CIRCLES) {
      const dx = px - ox, dz = pz - oz;
      if (dx * dx + dz * dz <= pr * pr) { mC[i] = 1; break; }
    }
    /* grounds polygon: even-odd ray cast */
    let ins = false;
    for (let a = 0, b = GPOLY.length - 1; a < GPOLY.length; b = a++) {
      const ax = GPOLY[a][0], az = GPOLY[a][1], bx = GPOLY[b][0], bz = GPOLY[b][1];
      if ((az > pz) !== (bz > pz) &&
          px < (bx - ax) * (pz - az) / (bz - az) + ax) ins = !ins;
    }
    mG[i] = ins ? 1 : 0;
  }
  const dC = chamfer(mC), dG = chamfer(mG);

  /* small hills, given directly in voxel space */
  const HILLS = [
    { x: 50, z: 190, r: 8.4, y: BASE_Y + 3 },         /* Hagrid's mound    */
    { x: 30, z: 160, r: 10,  y: BASE_Y + 4 },         /* stone circle hill */
    { rect: [221, 206, 238, 229], y: LAKE_Y + 2 }     /* boathouse rock    */
  ];

  /* ── pass 1: column heights ── */
  const hmap = new Int16Array(W * D);
  const flag = new Uint8Array(W * D);   /* 1 bed · 2 beach · 4 lip · 8 water */
  const FALLX = CX + 0.2 * R, FALLZ = CZ + 0.98 * R;

  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const i = x + W * z, dv = Math.hypot(x - CX, z - CZ);
    if (dv > edge[i]) continue;                          /* open sky beyond rim */
    let hh = BASE_Y + Math.floor(F(x, z) * 10 - 4);
    /* castle plateau: cliffs quantised to 3-voxel terraces + 1-voxel ledges */
    let d = dC[i] / 3;
    let drop = d * 2.6 * (0.65 + 0.8 * F2(x, z));
    drop = Math.floor(drop / 3) * 3 + (hash(x, 0, z, 11) < 0.16 ? 1 : 0);
    hh = Math.max(hh, PLAT_Y - 1 - drop);
    /* walled grounds tier */
    d = dG[i] / 3;
    drop = d * 1.6 * (0.65 + 0.8 * F2(x, z));
    drop = Math.floor(drop / 3) * 3 + (hash(x, 1, z, 11) < 0.16 ? 1 : 0);
    hh = Math.max(hh, GROUND2 - drop);
    /* hills */
    for (const hll of HILLS) {
      if (hll.rect) {
        const x0 = hll.rect[0], z0 = hll.rect[1], x1 = hll.rect[2], z1 = hll.rect[3];
        if (x >= x0 && x <= x1 && z >= z0 && z <= z1) hh = Math.max(hh, hll.y);
        else if (x >= x0 - 4 && x <= x1 + 4 && z >= z0 - 4 && z <= z1 + 4) {
          const ox = Math.max(x0 - x, x - x1, 0), oz = Math.max(z0 - z, z - z1, 0);
          hh = Math.max(hh, hll.y - Math.hypot(ox, oz) * 1.2);
        }
      } else {
        const dd = Math.hypot(x - hll.x, z - hll.z);
        if (dd < hll.r + 7) hh = Math.max(hh, hll.y - Math.max(0, dd - hll.r) * 1.1);
      }
    }
    /* the lake */
    const lf = (z - CZ) + 0.25 * (x - CX) - 36 + (F(x, z) - 0.5) * 40;
    const nearRim = dv > edge[i] - 4.2;
    const nearFall = Math.hypot(x - FALLX, z - FALLZ) < 3.6;
    let fl = 0;
    if (lf > 0 && hh < BASE_Y + 11) {                         /* lake bed */
      hh = LAKE_Y - (2 + Math.min(7, Math.floor(lf * 0.14 + F2(x, z) * 2.2)));
      fl = 1 | 8;
    } else if (lf > -5 && lf <= 0 && hh < BASE_Y + 12) {      /* beach band */
      if (hh < LAKE_Y + 1) hh = LAKE_Y + 1;
      fl = 2;
    }
    if (nearRim && lf > -10 && !nearFall) {                   /* stone lip holds water */
      if (hh < LAKE_Y + 2) hh = LAKE_Y + 2;
      fl = (fl & ~1) | 4;
    }
    hmap[i] = hh; flag[i] = fl;
  }

  /* ── pass 2a: per-column underside depth field ── */
  const ybA = new Int16Array(W * D), solidA = new Uint8Array(W * D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const i = x + W * z;
    if (hmap[i] === 0 && flag[i] === 0) continue;
    const dv = Math.hypot(x - CX, z - CZ);
    if (dv > edge[i]) continue;
    const F1 = F(x, z);
    const t = clamp(dv / R, 0, 1);
    let dep = 8 + 46 * (1 - Math.pow(t, 1.5)) + F1 * 12;
    dep = Math.floor(dep / 6) * 6;
    ybA[i] = Math.max(2, LAKE_Y - 6 - dep);
    solidA[i] = 1;
  }
  /* smooth the tier staircase: never open a notch deeper than 5 voxels —
     fills the see-through gaps between neighbouring tier steps */
  for (let pass = 0; pass < 2; pass++)
    for (let z = 1; z < D - 1; z++) for (let x = 1; x < W - 1; x++) {
      const i = x + W * z;
      if (!solidA[i]) continue;
      const lowest = Math.min(
        solidA[i + 1] ? ybA[i + 1] : ybA[i], solidA[i - 1] ? ybA[i - 1] : ybA[i],
        solidA[i + W] ? ybA[i + W] : ybA[i], solidA[i - W] ? ybA[i - W] : ybA[i]);
      if (ybA[i] > lowest + 5) ybA[i] = lowest + 5;
    }
  /* outer skirt: the outermost ~16-voxel ring extends down to the depth of the
     tier ~20 voxels inward, so the ring reads solid from level viewpoints */
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const i = x + W * z;
    if (!solidA[i]) continue;
    const dv = Math.hypot(x - CX, z - CZ);
    if (dv <= edge[i] - 16 || dv < 24) continue;
    const k = (dv - 20) / dv;
    const xi = Math.round(CX + (x - CX) * k), zi = Math.round(CZ + (z - CZ) * k);
    if (xi < 0 || xi >= W || zi < 0 || zi >= D) continue;
    const inner = ybA[xi + W * zi];
    if (solidA[xi + W * zi] && ybA[i] > inner + 3) ybA[i] = inner + 3;
  }
  for (let pass = 0; pass < 3; pass++)
    for (let z = 1; z < D - 1; z++) for (let x = 1; x < W - 1; x++) {
      const i = x + W * z;
      if (!solidA[i]) continue;
      const lowest = Math.min(
        solidA[i + 1] ? ybA[i + 1] : ybA[i], solidA[i - 1] ? ybA[i - 1] : ybA[i],
        solidA[i + W] ? ybA[i + W] : ybA[i], solidA[i - W] ? ybA[i - W] : ybA[i]);
      if (ybA[i] > lowest + 4) ybA[i] = lowest + 4;
    }

  /* ── pass 2b: fill columns with strata & surface materials ── */
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const i = x + W * z;
    if (!solidA[i]) continue;
    const hh = hmap[i], fl = flag[i];
    const F2c = F2(x, z);
    const strat = y => (y + Math.floor(F2c * 8)) % 9 < 2;
    /* steepness from neighbour height drop */
    let steep = false, rim = Math.hypot(x - CX, z - CZ) > edge[i] - 1.6;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [ox, oz] of nb) {
      const j = (x + ox) + W * (z + oz);
      if (j >= 0 && j < W * D && hmap[j] !== 0) {
        if (hh - hmap[j] > 2) steep = true;
      } else steep = steep || rim;
    }
    let topM;
    if (fl & 4) topM = ROCK3;
    else if (fl & 2) topM = SAND;
    else if (fl & 1) topM = hash(x, hh, z, 12) < 0.6 ? DIRT : ROCK2;
    else if (steep) topM = hash(x, hh, z, 12) < 0.55 ? ROCK : MOSS;
    else {
      const vn = vnoise(x * 0.09, z * 0.09, 808);
      topM = vn < 0.35 ? GRASS2 : (hash(x, hh, z, 12) < 0.85 ? GRASS : MOSS);
    }
    if (rim && !(fl & 4)) topM = ROCK3;

    const yb = ybA[i];
    for (let y = yb; y <= hh; y++) {
      let m;
      if (y === hh) m = topM;
      else if (y < LAKE_Y - 18) {                           /* deep underside core */
        m = (Math.floor(y + F(x, z) * 6) % 7 < 2) ? UNDER
            : (hash(x, y, z, 62) < 0.5 ? ROCK : ROCK2);
      } else if (y >= hh - 2 - Math.floor(hash(x, 0, z, 14) * 2) && !(fl & 1) &&
                 !(fl & 4) && (topM === GRASS || topM === GRASS2 || topM === MOSS)) {
        m = DIRT;                                           /* 1–2 soil under turf */
      } else if (strat(y)) m = hash(x, y, z, 52) < 0.4 ? ROCK : ROCK2;
      else m = hash(x, y, z, 51) < 0.14 ? ROCK3 : ROCK;
      set(x, y, z, m);
    }
    if (fl & 8) for (let y = hh + 1; y <= LAKE_Y; y++) set(x, y, z, WATER);
  }

  /* ── stalactites under the island ── */
  for (let n = 0; n < 70; n++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * (R - 8);
    const sx = Math.round(CX + Math.cos(a) * rr), sz = Math.round(CZ + Math.sin(a) * rr);
    const yb = ybA[sx + W * sz] || (LAKE_Y - 20);
    const len = 6 + Math.floor(rnd() * 12), cr = 1.5 + rnd() * 2.5;
    for (let k = 0; k < len; k++) {
      const r2 = cr * (1 - k / len) + 0.35;
      fillDisk(sx, sz, yb - k, r2, k < 2 ? ROCK2 : (hash(sx, k, sz, 71) < 0.3 ? UNDER : ROCK2));
    }
    if (rnd() < 0.38) { set(sx, yb - len, sz, CRYST); set(sx, yb - len - 1, sz, CRYST); }
  }

  /* ── the waterfall at the lip gap ── */
  const ovx = FALLX - CX, ovz = FALLZ - CZ, ol = Math.hypot(ovx, ovz);
  const ux = ovx / ol, uz = ovz / ol, pw = -uz, qw = ux;   /* outward + across */
  for (let f = 0; f <= 59; f++) {
    const y = LAKE_Y - 1 - f;                              /* 62 → 3 */
    if (y < 3) break;
    const out = Math.sqrt(f) * 0.9;
    const bx = FALLX + ux * out, bz = FALLZ + uz * out;
    const wOut = f > 40 ? 0 : (f > 24 ? 1 : 2);
    for (let wI = -wOut; wI <= wOut; wI++) {
      const x = Math.round(bx + pw * wI), z = Math.round(bz + qw * wI);
      const foam = f > 44 || hash(x, y, z, 91) < 0.25;
      set(x, y, z, foam ? FOAM : WATER);
    }
  }
  /* splash where it vanishes below */
  const sx2 = Math.round(FALLX + ux * Math.sqrt(58) * 0.9);
  const sz2 = Math.round(FALLZ + uz * Math.sqrt(58) * 0.9);
  for (let k = 0; k < 26; k++) {
    const an = rnd() * Math.PI * 2, rr2 = rnd() * 2.6;
    set(sx2 + Math.round(Math.cos(an) * rr2), 2 + Math.floor(rnd() * 3),
        sz2 + Math.round(Math.sin(an) * rr2), rnd() < 0.5 ? FOAM : WATER);
  }
}
