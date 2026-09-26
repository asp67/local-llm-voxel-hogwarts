/* ============================================================
   02_terrain.js — floating island: height field, lake, cliffs,
   underside, waterfall  (PROJECT.md §6)
   ============================================================ */

const DEG = Math.PI / 180;
// where the lake spills off the island edge
const FALL = [Math.round(CX + 0.2 * R), Math.round(CZ + 0.98 * R)]; // (170, 273)

// ---- plan-pixel shape tests (plan is 2000 px, north up) ----
function inRect(px, py, x0, y0, x1, y1) {
  return px >= x0 && px <= x1 && py >= y0 && py <= y1;
}
function inCirc(px, py, cx, cy, r) {
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}
function inORect(px, py, cx, cy, angDeg, hl, hw) {
  const a = angDeg * DEG, c = Math.cos(a), s = Math.sin(a);
  const dx = px - cx, dy = py - cy;
  const u = dx * c - dy * s, v = dx * s + dy * c;
  return Math.abs(u) <= hl && Math.abs(v) <= hw;
}
function inPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// union of every castle footprint — the gaps between masks become ravines
function castleMask(px, py) {
  return inRect(px, py, 1110, 430, 1590, 1035) ||      // greenhouse compound
         inRect(px, py, 945, 585, 1285, 925) ||         // north quadrangle
         inRect(px, py, 1265, 570, 1435, 1150) ||       // spine & nave
         inRect(px, py, 1185, 1025, 1515, 1185) ||      // south block
         inRect(px, py, 875, 900, 1095, 1100) ||        // apse
         inRect(px, py, 1090, 900, 1225, 1030) ||       // fountain plaza
         inORect(px, py, 835, 640, -22, 150, 95) ||     // NW angled wing
         inORect(px, py, 890, 700, 19, 125, 55) ||      // NW arm
         inRect(px, py, 1025, 365, 1185, 600) ||        // north connector
         inRect(px, py, 755, 1160, 1135, 1515) ||       // courtyard block
         inCirc(px, py, 1100, 1490, 115) ||             // astronomy circle
         inORect(px, py, 1125, 1655, -34.9, 240, 95) || // Great Hall
         inRect(px, py, 405, 1240, 715, 1435) ||        // clock courtyard
         inCirc(px, py, 1330, 1600, 45);                // stair head circle
}

const GROUNDS_POLY = [
  [1110, 360], [1000, 175], [890, 125], [660, 135], [520, 330],
  [470, 420], [560, 520], [720, 520], [950, 560], [1070, 560]
];

// two-pass chamfer distance transform (1, √2) over a 288×288 mask
function chamfer(mask) {
  const dist = new Float32Array(W * D);
  const INF = 1e9, D1 = 1, D2 = Math.SQRT2;
  for (let i = 0; i < W * D; i++) dist[i] = mask[i] ? 0 : INF;
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++) {
      const i = x + W * z;
      if (dist[i] === 0) continue;
      let d = dist[i];
      if (x > 0) d = Math.min(d, dist[i - 1] + D1);
      if (z > 0) d = Math.min(d, dist[i - W] + D1);
      if (x > 0 && z > 0) d = Math.min(d, dist[i - W - 1] + D2);
      if (x < W - 1 && z > 0) d = Math.min(d, dist[i - W + 1] + D2);
      dist[i] = d;
    }
  for (let z = D - 1; z >= 0; z--)
    for (let x = W - 1; x >= 0; x--) {
      const i = x + W * z;
      if (dist[i] === 0) continue;
      let d = dist[i];
      if (x < W - 1) d = Math.min(d, dist[i + 1] + D1);
      if (z < D - 1) d = Math.min(d, dist[i + W] + D1);
      if (x < W - 1 && z < D - 1) d = Math.min(d, dist[i + W + 1] + D2);
      if (x > 0 && z < D - 1) d = Math.min(d, dist[i + W - 1] + D2);
      dist[i] = d;
    }
  return dist;
}

function buildTerrain() {
  const hgtA = new Int16Array(W * D);   // final column top
  const kindA = new Uint8Array(W * D);  // 0 dry · 1 lake · 2 beach · 3 stone rim
  const ybA = new Int16Array(W * D);    // underside bottom
  const edgeA = new Float32Array(W * D);// jittered island radius per column

  // ---- region distance fields ----
  const fields = [];
  const makeField = (fn, h, slope) => {
    const mask = new Uint8Array(W * D);
    for (let z = 0; z < D; z++)
      for (let x = 0; x < W; x++)
        mask[x + W * z] = fn(x, z) ? 1 : 0;
    fields.push({ dist: chamfer(mask), h, slope });
  };
  makeField((x, z) => castleMask(PXinv(x), PZinv(z)), PLAT_Y - 1, 2.6);
  makeField((x, z) => inPoly(PXinv(x), PZinv(z), GROUNDS_POLY), GROUNDS_Y, 1.6);
  makeField((x, z) => (x - 50) * (x - 50) + (z - 190) * (z - 190) <= 8.4 * 8.4, BASE_Y + 3, 1.6);
  makeField((x, z) => (x - 30) * (x - 30) + (z - 160) * (z - 160) <= 100, BASE_Y + 4, 1.6);
  makeField((x, z) => inRect(PXinv(x), PZinv(z), 1740, 1600, 1880, 1790), LAKE_Y + 2, 2.6);

  // ---- pass A: column tops (edge · regions · lake · base) ----
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++) {
      const i = x + W * z;
      const dx = x - CX, dz = z - CZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const a = Math.atan2(dz, dx);
      // island edge: radius jittered ±2.5 by angular noise
      const edge = R + (vnoise(Math.cos(a) * 6 + 10, Math.sin(a) * 6 + 10) - 0.5) * 5;
      edgeA[i] = edge;
      if (dist > edge) continue;                    // open air beyond the island

      const nDrop = fbm(x * 0.05, z * 0.05);
      // grounds landmarks keep a clearing: suppress only the castle's terraced
      // skirt (d > 0) around them — plateau masks themselves are never touched
      const dHut = (x - 50) * (x - 50) + (z - 190) * (z - 190);
      const dCir = (x - 30) * (x - 30) + (z - 160) * (z - 160);
      const dWil = (x - 72) * (x - 72) + (z - 150) * (z - 150);
      const clearing = dHut < 900 || dCir < 900 || dWil < 900;
      let rmax = -1e9, rIn = -1e9;
      for (let f = 0; f < fields.length; f++) {
        const F = fields[f], d = F.dist[i];
        if (d >= 1e8) continue;
        if (clearing && d > 0 && f !== 2 && f !== 3) continue;
        let hc;
        if (d <= 0) { hc = F.h; if (hc > rIn) rIn = hc; }          // inside a plateau mask
        else {
          let drop = d * F.slope * (0.65 + 0.8 * nDrop);
          drop = Math.floor(drop / 3) * 3 + (hash(x, 13, z) < 0.4 ? 1 : 0); // 3-voxel terraces + ledges
          hc = F.h - drop;
        }
        if (hc > rmax) rmax = hc;
      }

      // base ground, lake bed and beach band
      const lakeT = (z - CZ) + 0.25 * (x - CX) - 36 + (fbm(x * 0.02, z * 0.02) - 0.5) * 40;
      let g, k = 0;
      if (lakeT > 0) { g = LAKE_Y - 2 - Math.floor(hash(x, 3, z) * 8); k = 1; }      // LAKE_Y-2 … -9
      else if (lakeT > -5) { g = LAKE_Y + 1; k = 2; }                               // beach band
      else g = BASE_Y + Math.floor(fbm(x * 0.03, z * 0.03) * 10 - 4);

      // the lake/beach override regional slopes, but never the plateau masks themselves
      hgtA[i] = Math.max(g, k === 0 ? rmax : rIn);
      kindA[i] = k;
    }

  // ---- pass B: stone lip along the lake rim (gap at the waterfall) ----
  // detect against a snapshot first — mutating kindA mid-scan would cascade
  const rimA = new Uint8Array(W * D);
  for (let z = 1; z < D - 1; z++)
    for (let x = 1; x < W - 1; x++) {
      const i = x + W * z;
      if (kindA[i] !== 1) continue;
      if (hgtA[i] >= LAKE_Y + 2) continue;                     // plateau masks stay dry
      const rim = kindA[i - 1] !== 1 || kindA[i + 1] !== 1 ||
                  kindA[i - W] !== 1 || kindA[i + W] !== 1;
      if (!rim) continue;
      const fdx = x - FALL[0], fdz = z - FALL[1];
      if (fdx * fdx + fdz * fdz <= 3.5 * 3.5) continue;  // 3.5-voxel gap
      rimA[i] = 1;
    }
  for (let i = 0; i < W * D; i++)
    if (rimA[i]) {
      kindA[i] = 3;
      if (hgtA[i] < LAKE_Y + 2) hgtA[i] = LAKE_Y + 2;
    }

  // ---- pass C: underside bottom (stepped "wedding cake") ----
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++) {
      const i = x + W * z;
      if (hgtA[i] === 0 && edgeA[i] === 0) continue;
      const dx = x - CX, dz = z - CZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > edgeA[i]) continue;
      const t = dist / R;
      const depth = 8 + 46 * (1 - Math.pow(t, 1.5)) + fbm(x * 0.04, z * 0.04) * 12;
      let yb = Math.floor((LAKE_Y - 6 - depth) / 6) * 6;   // 6-voxel tiers
      ybA[i] = yb < 0 ? 0 : yb;
    }

  // ---- pass D: fill columns with materials ----
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++) {
      const i = x + W * z;
      const hgt = hgtA[i], yb = ybA[i];
      if (hgt <= 0) continue;                       // outside the island — stays air
      const dx = x - CX, dz = z - CZ;
      if (Math.sqrt(dx * dx + dz * dz) > edgeA[i]) continue;
      const k = kindA[i];

      // neighbour drop → cliff top vs flat top
      let steep = false;
      const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let n = 0; n < 4; n++) {
        const nx = x + n4[n][0], nz = z + n4[n][1];
        if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
        const ni = nx + W * nz;
        if (edgeA[ni] === 0 && hgtA[ni] === 0) continue;   // outside island — not a drop
        if (hgt - hgtA[ni] > 2) { steep = true; break; }
      }

      let topM;
      if (k === 3) topM = PAL.ROCK3;                                   // stone lip
      else if (k === 1 && hgt < LAKE_Y)
        topM = hash(x, 7, z) < 0.5 ? PAL.DIRT : PAL.ROCK2;             // lake bed
      else if (k === 2 && hgt <= LAKE_Y + 1) topM = PAL.SAND;          // shore
      else if (steep) topM = hash(x, 9, z) < 0.62 ? PAL.ROCK : PAL.MOSS;
      else {
        const r = hash(x, 5, z);
        topM = r < 0.66 ? PAL.GRASS : r < 0.9 ? PAL.GRASS2 : PAL.MOSS;
      }
      set(x, hgt, z, topM);

      // 1–2 dirt under grass
      let nd = 0;
      if (topM === PAL.GRASS || topM === PAL.GRASS2 || topM === PAL.MOSS) {
        nd = 1 + (hash(x, 17, z) < 0.5 ? 1 : 0);
        for (let n = 1; n <= nd && hgt - n > yb; n++) set(x, hgt - n, z, PAL.DIRT);
      }

      // rock strata body down to the underside
      const warp = Math.floor(fbm(x * 0.08, z * 0.08) * 8);
      for (let y = hgt - 1 - nd; y >= yb; y--) {
        let m;
        if (y < LAKE_Y - 8) {
          const b = (y + warp) % 6;                                    // underside strata
          m = b < 3 ? PAL.UNDER : PAL.ROCK2;
        } else {
          const b = (y + warp) % 9;                                    // cliff strata
          m = b < 3 ? PAL.ROCK2 : b < 6 ? PAL.ROCK : PAL.ROCK3;
        }
        set(x, y, z, m);
      }

      // lake water up to LAKE_Y
      if (k === 1 && hgt < LAKE_Y)
        for (let y = hgt + 1; y <= LAKE_Y; y++) set(x, y, z, PAL.WATER);

      topY[i] = hgt;
    }

  // ---- stalactites + crystal tips under the island ----
  for (let s = 0; s < 70; s++) {
    const a = rnd() * TAU, rad = lerp(0.35, 0.95, rnd()) * R;
    const x = Math.round(CX + Math.cos(a) * rad), z = Math.round(CZ + Math.sin(a) * rad);
    if (x < 2 || x >= W - 2 || z < 2 || z >= D - 2) continue;
    const y0 = ybA[x + W * z];
    if (y0 <= 3) continue;
    const sr = rr(2, 4.5), len = ri(6, 18);
    const crystal = rnd() < 0.35;
    for (let kk = 1; kk <= len; kk++) {
      const rr2 = sr * (1 - kk / len);
      if (rr2 <= 0.15) break;
      const y = y0 - kk;
      if (y < 0) break;
      const tip = crystal && kk > len - 2;
      for (let dz = Math.ceil(-rr2); dz <= rr2; dz++)
        for (let dx = Math.ceil(-rr2); dx <= rr2; dx++)
          if (dx * dx + dz * dz <= rr2 * rr2 + 0.1) set(x + dx, y, z + dz, tip ? PAL.CRYST : PAL.UNDER);
    }
  }

  // ---- waterfall spilling off the island edge ----
  {
    const fdx = FALL[0] - CX, fdz = FALL[1] - CZ;
    const fl = Math.sqrt(fdx * fdx + fdz * fdz);
    const nx = fdx / fl, nz = fdz / fl;      // outward normal
    const px = -nz, pz = nx;                 // perpendicular (width axis)
    for (let y = LAKE_Y; y >= 4; y--) {
      const fallen = LAKE_Y - y;
      const out = Math.sqrt(fallen) * 0.9;
      const fx = FALL[0] + nx * out, fz = FALL[1] + nz * out;
      for (let w = -1.75; w <= 1.75; w += 0.5) {
        const wx = Math.round(fx + px * w), wz = Math.round(fz + pz * w);
        if (!inb(wx, y, wz)) continue;
        const m = y < 12 ? PAL.FOAM : (hash(wx, y, wz) < 0.22 ? PAL.FOAM : PAL.WATER);
        set(wx, y, wz, m);
      }
    }
  }
}