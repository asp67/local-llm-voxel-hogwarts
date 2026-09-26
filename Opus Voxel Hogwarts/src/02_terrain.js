
// ============================================================================
// 5. TERRAIN — floating, multi-tiered island
// ============================================================================
const topY = new Int16Array(W * D).fill(-1);   // top solid voxel per column
const TI = (x, z) => x + W * z;

// --- shape tests, written in plan-pixel coordinates --------------------------
function mRect(px0, py0, px1, py1) { const x0 = PX(px0), x1 = PX(px1), z0 = PZ(py0), z1 = PZ(py1);
  return (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1; }
function mCircle(px, py, pr) { const cx = PX(px), cz = PZ(py), r2 = (pr * S) ** 2;
  return (x, z) => (x - cx) ** 2 + (z - cz) ** 2 <= r2; }
function mOriented(px, py, angDeg, phl, phw) { const cx = PX(px), cz = PZ(py), a = angDeg * Math.PI / 180,
  c = Math.cos(a), s = Math.sin(a), hl = phl * S, hw = phw * S;
  return (x, z) => { const dx = x - cx, dz = z - cz; return Math.abs(dx * c + dz * s) <= hl && Math.abs(-dx * s + dz * c) <= hw; }; }
function mPoly(pts) { const p = pts.map(([a, b]) => [PX(a), PZ(b)]);
  return (x, z) => { let ins = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; } return ins; }; }
const any = (...fs) => (x, z) => fs.some(f => f(x, z));

// Chamfer distance transform (voxels) from a boolean mask.
function distField(test) {
  const d = new Float32Array(W * D), BIG = 1e6, Q = Math.SQRT2;
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) d[TI(x, z)] = test(x, z) ? 0 : BIG;
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) { const i = TI(x, z); let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 1);
    if (z > 0) { v = Math.min(v, d[i - W] + 1); if (x > 0) v = Math.min(v, d[i - W - 1] + Q); if (x < W - 1) v = Math.min(v, d[i - W + 1] + Q); }
    d[i] = v; }
  for (let z = D - 1; z >= 0; z--) for (let x = W - 1; x >= 0; x--) { const i = TI(x, z); let v = d[i];
    if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
    if (z < D - 1) { v = Math.min(v, d[i + W] + 1); if (x < W - 1) v = Math.min(v, d[i + W + 1] + Q); if (x > 0) v = Math.min(v, d[i + W - 1] + Q); }
    d[i] = v; }
  return d;
}

// Great Hall axis (plan px): centre, angle — reused by the castle builder.
const GH = { px: 1125, py: 1655, ang: -34.9 };

const REGIONS = [
  { name: 'castle', h: PLAT_Y - 1, slope: 2.6, test: any(
      mRect(1110, 430, 1590, 1035),   // greenhouse compound
      mRect(945, 585, 1285, 925),     // north range + courtyard
      mRect(1265, 570, 1435, 1150),   // spine
      mRect(1185, 1025, 1515, 1185),  // south block
      mRect(875, 900, 1095, 1100),    // apse / west blocks
      mRect(1090, 900, 1225, 1030),   // fountain plaza
      mOriented(835, 640, -22, 150, 95), // NW angled building
      mOriented(890, 700, 19, 125, 55),
      mRect(1025, 365, 1185, 600),    // north connector
      mRect(755, 1160, 1135, 1515),   // courtyard block
      mCircle(1100, 1490, 115),       // astronomy tower
      mOriented(GH.px, GH.py, GH.ang, 240, 95), // great hall
      mRect(405, 1240, 715, 1435),    // clock-tower courtyard
      mCircle(1330, 1600, 45),        // stair head
    ) },
  { name: 'grounds', h: BASE_Y + 18, slope: 1.6, test: mPoly([[1110, 360], [1000, 175], [890, 125], [660, 135], [520, 330],
      [470, 420], [560, 520], [720, 520], [950, 560], [1070, 560]]) },
  { name: 'hagrid', h: BASE_Y + 3, slope: 0.9, test: (x, z) => (x - 50) ** 2 + (z - 190) ** 2 < 70 },
  { name: 'circle', h: BASE_Y + 4, slope: 0.9, test: (x, z) => (x - 30) ** 2 + (z - 160) ** 2 < 100 },
  { name: 'boathouse', h: LAKE_Y + 2, slope: 0.8, test: mRect(1740, 1600, 1880, 1790) },
];

// Lake: a noisy half-plane to the south / south-east.
const lakeField = (x, z) => (z - CZ) + (x - CX) * 0.25 - 36 + (fbm(x * 0.02 + 50, z * 0.02) - 0.5) * 40;
const FALL = { x: Math.round(CX + R * 0.2), z: Math.round(CZ + R * 0.98) - 1 }; // waterfall lip
const islandR = (x, z) => R + Math.round((vnoise(Math.atan2(z - CZ, x - CX) * 7 + 40, 3) - 0.5) * 5);

function buildTerrain() {
  // 1. height field
  const hmap = new Int16Array(W * D).fill(-1);
  const fields = REGIONS.map(r => distField(r.test));
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const dist = Math.hypot(x - CX, z - CZ);
    if (dist > islandR(x, z)) continue;
    let h = BASE_Y + Math.floor(fbm(x * 0.035, z * 0.035) * 10 - 4);
    const lk = lakeField(x, z);
    if (lk > 0) h = Math.min(h, LAKE_Y - 2 - Math.min(7, Math.floor(lk / 5)));
    else if (lk > -5) h = Math.min(h, LAKE_Y + 1);
    else h = Math.max(h, LAKE_Y + 2);
    // West: gentle forest hills.
    if (x < CX - 50 && lk < -5) h += Math.floor(fbm(x * 0.06 + 9, z * 0.06) * 6);
    REGIONS.forEach((r, k) => {
      const d = fields[k][TI(x, z)];
      if (d > 60) return;
      const sl = r.slope * (0.65 + 0.8 * fbm(x * 0.05 + k * 13, z * 0.05));
      let drop = d * sl;
      if (drop > 0) drop = Math.ceil((drop + fbm(x * 0.2, z * 0.2 + k) * 3) / 3) * 3 - (hash(x, k, z) < 0.25 ? 1 : 0);
      h = Math.max(h, r.h - Math.max(0, Math.floor(drop)));
    });
    // Stone lip that keeps the lake inside the island.
    const rim = islandR(x, z);
    if (dist > rim - 2.5 && h < LAKE_Y + 1) {
      const nearFall = Math.hypot(x - FALL.x, z - FALL.z) < 3.5;
      h = nearFall ? LAKE_Y - 1 : LAKE_Y + 2;
    }
    hmap[TI(x, z)] = h;
  }
  // 2. voxel columns
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const h = hmap[TI(x, z)];
    if (h < 0) continue;
    const dist = Math.hypot(x - CX, z - CZ), t = dist / R;
    // Thick cuboid edge, then an inverted stepped "wedding cake" down to a rocky keel.
    let depth = 8 + 46 * (1 - Math.pow(Math.min(1, t), 1.5)) + fbm(x * 0.07, z * 0.07 + 30) * 12;
    depth = Math.floor(depth / 6) * 6;                                   // tiered underside
    const yb = Math.max(1, LAKE_Y - 6 - depth);
    let steep = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = (x + dx >= 0 && x + dx < W && z + dz >= 0 && z + dz < D) ? hmap[TI(x + dx, z + dz)] : -1;
      steep = Math.max(steep, n < 0 ? 0 : h - n);
    }
    const strata = Math.floor(fbm(x * 0.05, z * 0.05) * 8);
    for (let y = yb; y <= h; y++) {
      const dt = h - y;
      let m;
      if (dt === 0) {
        if (h <= LAKE_Y - 1) m = h >= LAKE_Y - 2 ? SAND : (hash(x, y, z) < 0.5 ? DIRT : ROCK2);
        else if (h <= LAKE_Y + 1 && hmap[TI(x, z)] < BASE_Y && dist < R - 3) m = SAND;
        else if (dist > islandR(x, z) - 2.5 && h === LAKE_Y + 2) m = ROCK3;
        else if (steep > 2) m = hash(x, y, z) < 0.3 ? MOSS : ROCK;
        else m = fbm(x * 0.15, z * 0.15) > 0.55 ? GRASS2 : (hash(x, 1, z) < 0.05 ? MOSS : GRASS);
      } else if (dt <= 2 && steep <= 2 && h > LAKE_Y + 1) m = DIRT;
      else if (y < LAKE_Y - 8) {
        const b = mod(y + strata, 7);
        m = b < 3 ? UNDER : b < 5 ? ROCK2 : (b === 5 ? DIRT : UNDER);
      } else {
        const b = mod(y + strata, 9);
        m = b < 3 ? ROCK3 : b < 7 ? ROCK : ROCK2;
      }
      set(x, y, z, m);
    }
    for (let y = h + 1; y <= LAKE_Y; y++) set(x, y, z, WATER);
    topY[TI(x, z)] = h;
  }
  // 3. hanging stalactites & glowing crystals under the island
  for (let n = 0; n < 70; n++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * R * 0.8;
    const x = Math.round(CX + Math.cos(a) * d), z = Math.round(CZ + Math.sin(a) * d);
    let yb = -1; for (let y = 0; y < LAKE_Y; y++) if (get(x, y, z)) { yb = y; break; }
    if (yb < 3) continue;
    const L = ri(6, 18), r0 = rr(2, 4.5);
    for (let k = 1; k <= L && yb - k > 0; k++) {
      const r = r0 * (1 - k / (L + 1));
      const r2 = (r + 0.4) ** 2;
      for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++)
        if (dx * dx + dz * dz <= r2) set(x + dx, yb - k, z + dz, (k === L && rand() < 0.35) ? CRYST : (mod(k, 4) === 0 ? ROCK2 : UNDER));
    }
  }
  // 4. waterfall spilling over the rim
  for (let y = LAKE_Y; y > 4; y--) {
    const fallen = LAKE_Y - y, out = Math.floor(Math.sqrt(fallen) * 0.9) + 1;
    for (let w = -2; w <= 2; w++) {
      const x = FALL.x + w, z = FALL.z + out + (fallen > 30 ? ri(0, 1) : 0);
      if (!isSolid(get(x, y, z))) set(x, y, z, (hash(x, y, z) < 0.18 || fallen > 30) ? FOAM : WATER);
      if (fallen < 3) set(x, y, z - 1, WATER);
    }
  }
}
