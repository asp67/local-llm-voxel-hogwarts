/* ============================================================
   01_core.js — grid, constants, palette, noise, RNG, primitives
   All src/*.js files are concatenated into one <script type="module">,
   so everything declared here is shared module scope.
   ============================================================ */

// ---------------- world constants ----------------
const W = 288, H = 208, D = 288;          // voxel grid (x, y, z)
const CX = 144, CZ = 144;                  // island centre
const R = 132;                              // island top radius
const LAKE_Y = 63;                          // top water voxel
const BASE_Y = 65;                          // lowest grass tier
const PLAT_Y = 100;                         // castle floor (plateau top voxel = 99)
const GROUNDS_Y = BASE_Y + 18;              // 83 — NW walled grounds
const S = 0.12;                             // plan px -> voxel scale
const TAU = Math.PI * 2;

const grid = new Uint8Array(W * H * D);     // material ids, 0 = air (~17 MB)
const topY = new Int16Array(W * D).fill(-1); // terrain top per column

const idx = (x, y, z) => x + W * (z + D * y);
const inb = (x, y, z) => x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D;
const colIdx = (x, z) => x + W * z;

// out of bounds reads as air; writes are clamped away
function get(x, y, z) {
  if (x < 0 || x >= W || y < 0 || y >= H || z < 0 || z >= D) return 0;
  return grid[x + W * (z + D * y)];
}
function set(x, y, z, m) {
  if (x < 0 || x >= W || y < 0 || y >= H || z < 0 || z >= D) return;
  grid[x + W * (z + D * y)] = m;
}
const solid = (x, y, z) => get(x, y, z) !== 0;

function surf(x, z) {                       // final terrain surface of a column
  if (x < 0 || x >= W || z < 0 || z >= D) return 0;
  return topY[x + W * z];
}
function refreshTop(x, z) {                // recompute topY after carving
  if (x < 0 || x >= W || z < 0 || z >= D) return;
  const c = x + W * z;
  let y = topY[c];
  if (y < 0) return;
  while (y + 1 < H && solid(x, y + 1, z)) y++;     // grow up first (buildings)
  while (y >= 0 && !solid(x, y, z)) y--;           // then down (carving)
  topY[c] = y;
}

// ---------------- plan-pixel mapping ----------------
// the 2000 px reference plan: east = +x, south = +z
const PX = px => Math.round(CX + (px - 1100) * S);
const PZ = py => Math.round(CZ + (py - 1080) * S);
const PXinv = x => (x - CX) / S + 1100;
const PZinv = z => (z - CZ) / S + 1080;

// ---------------- palette ----------------
const MATS = [null];                       // id 0 = air
const PAL = {};
const M_R = new Float32Array(256), M_G = new Float32Array(256), M_B = new Float32Array(256);
const M_VARY = new Float32Array(256), M_KIND = new Uint8Array(256), M_OPAQUE = new Uint8Array(256);

function mat(name, hex, kind, vary) {
  const c = new THREE.Color(hex);          // sRGB hex -> linear working space
  const id = MATS.length;
  MATS.push({ id, name, hex, kind, vary, color: c });
  PAL[name] = id;
  M_R[id] = c.r; M_G[id] = c.g; M_B[id] = c.b;
  M_VARY[id] = vary;
  M_KIND[id] = kind;
  M_OPAQUE[id] = (kind === 1 || kind === 2) ? 1 : 0;
  return id;
}
// kind: 1 solid (Lambert) · 2 emissive (unlit + bloom) · 3 water · 4 glass
// vary: ± brightness jitter per voxel ("grain")
mat('STONE',  0x857563, 1, 0.050);   // castle walls
mat('STONE2', 0x665a4d, 1, 0.050);   // plinths, string courses, foundations
mat('STONE3', 0xa1917b, 1, 0.050);   // trim, crenels, quoins, sills, paving
mat('ROOF',   0x33457e, 1, 0.050);   // slate roof
mat('ROOF2',  0x243260, 1, 0.050);   // ridge & eaves
mat('COPPER', 0x4f9483, 1, 0.050);   // spire tips
mat('WIN',    0xffa845, 2, 0.020);   // lit windows
mat('WIN2',   0xffcf78, 2, 0.020);   // Great Hall windows
mat('WINDK',  0x1a2034, 1, 0.040);   // dark window
mat('GRASS',  0x3b5a2d, 1, 0.090);
mat('GRASS2', 0x2f4b27, 1, 0.090);
mat('MOSS',   0x46552f, 1, 0.090);
mat('DIRT',   0x5a4532, 1, 0.080);
mat('ROCK',   0x5d5852, 1, 0.100);   // cliffs (strata)
mat('ROCK2',  0x4a4540, 1, 0.100);
mat('ROCK3',  0x6e675e, 1, 0.100);
mat('UNDER',  0x3a332e, 1, 0.100);   // island underside
mat('WATER',  0x1c3f78, 3, 0.040);
mat('FOAM',   0x9fc3e8, 3, 0.040);
mat('GLASS',  0x86c7b4, 4, 0.030);
mat('WOOD',   0x5a3b22, 1, 0.070);
mat('WOOD2',  0x7b5534, 1, 0.070);
mat('TRUNK',  0x3a2a1b, 1, 0.080);
mat('LEAF',   0x1f3b26, 1, 0.100);
mat('LEAF2',  0x2b4b2b, 1, 0.100);
mat('LEAF3',  0x162c1e, 1, 0.100);
mat('LANT',   0xffcf6b, 2, 0.020);   // lanterns
mat('CANDLE', 0xfff1c4, 2, 0.020);   // boat candles
mat('PATH',   0x7a7062, 1, 0.070);
mat('GRAVEL', 0x6b6357, 1, 0.080);
mat('SAND',   0x8a7b5f, 1, 0.080);
mat('GOLD',   0xd4a93a, 1, 0.050);   // hoops, finials
mat('RED',    0x8e1f1f, 1, 0.060);
mat('GREENH', 0x1f6b3a, 1, 0.060);
mat('BLUEH',  0x23408e, 1, 0.060);
mat('YELL',   0xc9a227, 1, 0.060);
mat('PUMPK',  0xd9731c, 1, 0.060);
mat('PALEST', 0x9b978f, 1, 0.060);   // stone circle, Hagrid's hut
mat('CLOCK',  0xe8dcb0, 2, 0.020);   // clock faces
mat('TRAINR', 0x9b1b1b, 1, 0.060);
mat('BLACK',  0x1b1b20, 1, 0.050);
mat('IRON',   0x2b2b31, 1, 0.060);
mat('CARB',   0x6d9cc2, 1, 0.060);   // Ford Anglia
mat('PLANT',  0x3f7a3a, 1, 0.090);
mat('SQUID',  0x3d2c44, 1, 0.070);
mat('CRYST',  0x6fb6ff, 2, 0.030);   // glowing crystals under the island

const LIGHTS = [];                        // warm point lights collected while building

// ---------------- randomness ----------------
function hash(x, y, z) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) * 2.3283064365386963e-10;
}

function vnoise(x, z) {                    // smooth 2D value noise
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, 57, zi), b = hash(xi + 1, 57, zi);
  const c = hash(xi, 57, zi + 1), d = hash(xi + 1, 57, zi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x, z, oct = 4) {              // fractal sum
  let amp = 0.5, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x, z); norm += amp;
    x = x * 2.03 + 17.3; z = z * 2.03 + 9.1;
    amp *= 0.5;
  }
  return sum / norm;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RNG = mulberry32(19910731);          // deterministic placement stream
const rnd = () => RNG();
const rr = (a, b) => a + RNG() * (b - a);  // random float in [a,b)
const ri = (a, b) => a + Math.floor(RNG() * (b - a + 1)); // random int in [a,b]
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------- primitive shapes ----------------
// inclusive axis-aligned box
function box(x0, y0, z0, x1, y1, z1, m) {
  if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
  if (y0 > y1) { const t = y0; y0 = y1; y1 = t; }
  if (z0 > z1) { const t = z0; z0 = z1; z1 = t; }
  const xa = Math.max(0, x0), xb = Math.min(W - 1, x1);
  const ya = Math.max(0, y0), yb = Math.min(H - 1, y1);
  const za = Math.max(0, z0), zb = Math.min(D - 1, z1);
  for (let y = ya; y <= yb; y++)
    for (let z = za; z <= zb; z++) {
      const row = xa + W * (z + D * y);
      for (let x = xa; x <= xb; x++) grid[row + x - xa] = m;
    }
}

// box that only writes into empty cells
function boxAir(x0, y0, z0, x1, y1, z1, m) {
  if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
  if (y0 > y1) { const t = y0; y0 = y1; y1 = t; }
  if (z0 > z1) { const t = z0; z0 = z1; z1 = t; }
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
    for (let z = Math.max(0, z0); z <= Math.min(D - 1, z1); z++)
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++)
        if (grid[idx(x, y, z)] === 0) set(x, y, z, m);
}

// horizontal disc at height y
function disk(cx, cz, r, y, m) {
  const r2 = r * r;
  for (let z = Math.floor(cz - r); z <= cz + r; z++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz <= r2) set(x, y, z, m);
    }
}

// filled vertical cylinder
function cyl(cx, cz, r, y0, y1, m) {
  const r2 = r * r;
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
    for (let z = Math.floor(cz - r); z <= cz + r; z++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dx = x - cx, dz = z - cz;
        if (dx * dx + dz * dz <= r2) set(x, y, z, m);
      }
}

// hollow ring (towers, walls)
function ring(cx, cz, r, y0, y1, m, th = 0) {
  const ro = r + th, ri2 = (r - 0.5) * (r - 0.5), ro2 = ro * ro;
  for (let y = y0; y <= y1; y++)
    for (let z = Math.floor(cz - ro); z <= cz + ro; z++)
      for (let x = Math.floor(cx - ro); x <= cx + ro; x++) {
        const d = (x - cx) * (x - cx) + (z - cz) * (z - cz);
        if (d <= ro2 && d >= ri2) set(x, y, z, m);
      }
}

// drop masonry straight down from yFrom until hitting solid ground (max len)
function dropFill(x, z, yFrom, m, maxLen = 70) {
  for (let y = yFrom, n = 0; y >= 0 && n <= maxLen; y--, n++) {
    if (solid(x, y, z)) return;
    set(x, y, z, m);
  }
}

// ---------------- rotated / oriented helpers ----------------
// local -> world: u along the length, v across
function toWorld(cx, cz, ang, u, v) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [Math.round(cx + u * c + v * s), Math.round(cz - u * s + v * c)];
}
function toLocal(cx, cz, ang, x, z) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const dx = x - cx, dz = z - cz;
  return [dx * c - dz * s, dx * s + dz * c];
}
// iterate every world column of a rotated rectangle; fn(u, v, x, z)
// with integer u (along length) and v (across) by nearest-neighbour rounding,
// so rotated buildings stay crisp voxel art.
function oriented2D(cx, cz, ang, hl, hw, fn) {
  const c = Math.abs(Math.cos(ang)), s = Math.abs(Math.sin(ang));
  const ex = Math.ceil(hl * c + hw * s), ez = Math.ceil(hl * s + hw * c);
  for (let z = Math.floor(cz - ez); z <= cz + ez; z++)
    for (let x = Math.floor(cx - ex); x <= cx + ex; x++) {
      const l = toLocal(cx, cz, ang, x, z);
      const u = Math.round(l[0]), v = Math.round(l[1]);
      if (Math.abs(u) <= hl && Math.abs(v) <= hw) fn(u, v, x, z);
    }
}
// solid rotated box between two heights
function oriented(cx, cz, ang, hl, hw, y0, y1, m) {
  oriented2D(cx, cz, ang, hl, hw, (u, v, x, z) => {
    for (let y = y0; y <= y1; y++) set(x, y, z, m);
  });
}

// ---------------- line walking ----------------
// DDA over a segment: fn(x, z, t) with t in 0..1 (no gaps)
function line2(x0, z0, x1, z1, fn) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fn(Math.round(lerp(x0, x1, t)), Math.round(lerp(z0, z1, t)), t);
  }
}
// 3D variant: fn(x, y, z, t)
function line3(x0, y0, z0, x1, y1, z1, fn) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fn(Math.round(lerp(x0, x1, t)), Math.round(lerp(y0, y1, t)),
       Math.round(lerp(z0, z1, t)), t);
  }
}