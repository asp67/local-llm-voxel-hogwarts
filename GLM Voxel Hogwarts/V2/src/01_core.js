/* ════════════════════════════════════════════════════════════════════
   01_core.js — voxel grid, constants, palette, noise, RNG, primitives
   ════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';

/* ── world constants ── */
const W = 288, H = 208, D = 288;
const CX = 144, CZ = 144, R = 132;
const LAKE_Y = 63, BASE_Y = 65, PLAT_Y = 100, GROUND2 = BASE_Y + 18;   /* 83 */
const S = 0.12;                                  /* voxel per plan pixel */
const DR = Math.PI / 180;
const PX = px => Math.round(CX + (px - 1100) * S);   /* plan x → voxel x (east=+x) */
const PZ = py => Math.round(CZ + (py - 1080) * S);   /* plan y → voxel z (south=+z) */
const PF = px => CX + (px - 1100) * S;               /* float variants */
const QZ = py => CZ + (py - 1080) * S;

/* ── grid ── */
const grid = new Uint8Array(W * H * D);
const topY = new Uint8Array(W * D);          /* y of top solid (non-liquid) voxel, 0 = none */
const I  = (x, y, z) => x + W * (z + D * y);
const inb = (x, y, z) => x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D;
const get = (x, y, z) => inb(x, y, z) ? grid[I(x, y, z)] : 0;
const surfY = (x, z) => (x >= 0 && x < W && z >= 0 && z < D) ? topY[x + W * z] : 0;
const surfTop = (x, z) => surfY(x, z) + 1;

function set(x, y, z, m) {
  if (!inb(x, y, z)) return;
  const i = I(x, y, z); grid[i] = m;
  const t = x + W * z;
  if (m && KIND[m] >= 3) return;                       /* water/glass never raise topY */
  if (m) { if (y > topY[t]) topY[t] = y; }
  else if (y >= topY[t]) {                             /* carve: rescan the column */
    let yy = y;
    while (yy > 0) { const g = grid[I(x, yy, z)]; if (g && KIND[g] < 3) break; yy--; }
    topY[t] = yy;
  }
}

/* ── palette ── */
const PAL = [null], MAT = { AIR: 0 };
function mat(name, hex, kind = 1, vary = 0.05) {
  const c = new THREE.Color(hex);
  const id = PAL.push({ name, hex, kind, vary, c }) - 1;
  MAT[name] = id; return id;
}
mat('STONE',  '#857563', 1, 0.05);   mat('STONE2', '#665a4d', 1, 0.05);
mat('STONE3', '#a1917b', 1, 0.05);
mat('ROOF',   '#33457e', 1, 0.04);   mat('ROOF2',  '#243260', 1, 0.04);
mat('COPPER', '#4f9483', 1, 0.05);
mat('WIN',    '#ffa845', 2, 0.10);   mat('WIN2',   '#ffcf78', 2, 0.08);
mat('WINDK',  '#1a2034', 1, 0.06);
mat('GRASS',  '#3b5a2d', 1, 0.10);   mat('GRASS2', '#2f4b27', 1, 0.10);
mat('MOSS',   '#46552f', 1, 0.10);
mat('DIRT',   '#5a4532', 1, 0.08);
mat('ROCK',   '#5d5852', 1, 0.07);   mat('ROCK2',  '#4a4540', 1, 0.07);
mat('ROCK3',  '#6e675e', 1, 0.06);
mat('UNDER',  '#3a332e', 1, 0.07);
mat('WATER',  '#1c3f78', 3, 0.02);   mat('FOAM',   '#9fc3e8', 3, 0.10);
mat('GLASS',  '#86c7b4', 4, 0.03);
mat('WOOD',   '#5a3b22', 1, 0.07);   mat('WOOD2',  '#7b5534', 1, 0.07);
mat('TRUNK',  '#3a2a1b', 1, 0.08);
mat('LEAF',   '#1f3b26', 1, 0.12);   mat('LEAF2',  '#2b4b2b', 1, 0.12);
mat('LEAF3',  '#162c1e', 1, 0.12);
mat('LANT',   '#ffcf6b', 2, 0.06);   mat('CANDLE', '#fff1c4', 2, 0.05);
mat('PATH',   '#7a7062', 1, 0.09);   mat('GRAVEL', '#6b6357', 1, 0.10);
mat('SAND',   '#8a7b5f', 1, 0.09);
mat('GOLD',   '#d4a93a', 1, 0.08);
mat('RED',    '#8e1f1f', 1, 0.06);   mat('GREENH', '#1f6b3a', 1, 0.06);
mat('BLUEH',  '#23408e', 1, 0.06);   mat('YELL',   '#c9a227', 1, 0.06);
mat('PUMPK',  '#d9731c', 1, 0.08);
mat('PALEST', '#9b978f', 1, 0.05);
mat('CLOCK',  '#e8dcb0', 2, 0.03);
mat('TRAINR', '#9b1b1b', 1, 0.05);   mat('BLACK',  '#1b1b20', 1, 0.04);
mat('IRON',   '#2b2b31', 1, 0.05);
mat('CARB',   '#6d9cc2', 1, 0.05);
mat('PLANT',  '#3f7a3a', 1, 0.12);
mat('SQUID',  '#3d2c44', 1, 0.05);
mat('CRYST',  '#6fb6ff', 2, 0.10);

const KIND = new Uint8Array(256), VARY = new Float32Array(256);
const CCH = new Float32Array(256 * 3);
for (let i = 1; i < PAL.length; i++) {
  KIND[i] = PAL[i].kind; VARY[i] = PAL[i].vary;
  CCH[i * 3] = PAL[i].c.r; CCH[i * 3 + 1] = PAL[i].c.g; CCH[i * 3 + 2] = PAL[i].c.b;
}
/* material id constants used by every build module */
const { STONE, STONE2, STONE3, ROOF, ROOF2, COPPER, WIN, WIN2, WINDK,
        GRASS, GRASS2, MOSS, DIRT, ROCK, ROCK2, ROCK3, UNDER, WATER, FOAM, GLASS,
        WOOD, WOOD2, TRUNK, LEAF, LEAF2, LEAF3, LANT, CANDLE, PATH, GRAVEL, SAND,
        GOLD, RED, GREENH, BLUEH, YELL, PUMPK, PALEST, CLOCK, TRAINR, BLACK, IRON,
        CARB, PLANT, SQUID, CRYST } = MAT;

/* ── noise & randomness ── */
function hash(x, y, z, w = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^
          Math.imul(z | 0, 1442695041) ^ Math.imul(w | 0, 2654435761) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, z, s = 0) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi, 0, s),     b = hash(xi + 1, zi, 0, s);
  const c = hash(xi, zi + 1, 0, s), d = hash(xi + 1, zi + 1, 0, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, oct = 4, s = 0) {
  let a = 0.5, f = 1, t = 0, n = 0;
  for (let i = 0; i < oct; i++) { t += a * vnoise(x * f, z * f, s + i * 7); n += a; a *= 0.5; f *= 2; }
  return t / n;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RNG = mulberry32(19910731);
const rnd = () => RNG();

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

/* ── primitives ── */
function fillBox(x0, y0, z0, x1, y1, z1, m) {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++)
    set(x, y, z, m);
}
function fillDisk(cx, cz, y, r, m) {
  const ri = Math.ceil(r);
  for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++)
    if (dx * dx + dz * dz <= r * r + 0.25) set(cx + dx, y, cz + dz, m);
}
function fillCyl(cx, cz, y0, y1, r, m) { for (let y = y0; y <= y1; y++) fillDisk(cx, cz, y, r, m); }
function dropFill(x, z, y0, m, max = 75, pierce = false) {
  let y = y0;
  for (let n = 0; n < max && y >= 0; n++) {
    const g = get(x, y, z);
    if (g && (!pierce || KIND[g] !== 3)) break;   /* pierce continues through water */
    set(x, y, z, m); y--;
  }
}
/* rotated-rect iteration: hands local (u along length, v across) + world voxel coords */
function oriented2D(cx, cz, angDeg, hl, hw, fn) {
  const a = angDeg * DR, ca = Math.cos(a), sa = Math.sin(a);
  const rad = Math.ceil(Math.hypot(hl, hw)) + 2;
  for (let z = Math.floor(cz) - rad; z <= Math.ceil(cz) + rad; z++)
    for (let x = Math.floor(cx) - rad; x <= Math.ceil(cx) + rad; x++) {
      const dx = x - cx, dz = z - cz;
      const u = dx * ca + dz * sa, v = -dx * sa + dz * ca;
      if (u >= -hl - 0.49 && u <= hl + 0.49 && v >= -hw - 0.49 && v <= hw + 0.49)
        fn(u, v, x, z);
    }
}
function toWorld2(cx, cz, angDeg, u, v) {
  const a = angDeg * DR, ca = Math.cos(a), sa = Math.sin(a);
  return [cx + u * ca - v * sa, cz + u * sa + v * ca];
}
function lineV(x0, y0, z0, x1, y1, z1, m, th = 0) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(lerp(x0, x1, i / n)), y = Math.round(lerp(y0, y1, i / n)),
          z = Math.round(lerp(z0, z1, i / n));
    if (th) fillBox(x - th, y - th, z - th, x + th, y + th, z + th, m); else set(x, y, z, m);
  }
}

/* shared state used across build modules */
const POINTS = [];                        /* warm point lights: {x,y,z,s} */
