import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ============================================================================
// 1. WORLD GRID
// ============================================================================
// One voxel = one world unit. The grid stores a material id (0 = air) per cell.
const W = 288, H = 208, D = 288;     // x, y, z extents
const CX = 144, CZ = 144;            // island centre (x, z)
const R = 132;                       // island top radius
const LAKE_Y = 63;                   // top water voxel
const BASE_Y = 65;                   // lowest grass tier (top voxel)
const PLAT_Y = 100;                  // castle floor (first voxel above plateau)
const grid = new Uint8Array(W * H * D);
const I = (x, y, z) => x + W * (z + D * y);
const inb = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D;
function set(x, y, z, m) { if (inb(x, y, z)) grid[I(x, y, z)] = m; }
function get(x, y, z) { return inb(x, y, z) ? grid[I(x, y, z)] : 0; }
function setAir(x, y, z) { if (inb(x, y, z)) grid[I(x, y, z)] = 0; }

// Plan-image pixel coordinates (reference: 2000px top-down plan, north up) -> voxel coords.
const S = 0.12;
const PX = px => Math.round(CX + (px - 1100) * S);
const PZ = py => Math.round(CZ + (py - 1080) * S);

// ============================================================================
// 2. PALETTE  (kind: 1 solid, 2 emissive, 3 water, 4 glass)
// ============================================================================
const PAL = [null];
function mat(hex, kind = 1, vary = 0.07) { PAL.push({ hex, kind, vary }); return PAL.length - 1; }
const STONE  = mat(0x857563, 1, 0.10);  // castle sandstone
const STONE2 = mat(0x665a4d, 1, 0.09);  // darker courses / plinths / foundations
const STONE3 = mat(0xa1917b, 1, 0.07);  // trim, crenels, quoins
const ROOF   = mat(0x33457e, 1, 0.08);  // slate blue
const ROOF2  = mat(0x243260, 1, 0.07);  // ridge / eaves
const COPPER = mat(0x4f9483, 1, 0.08);  // verdigris spire tips
const WIN    = mat(0xffa845, 2, 0.10);  // lit window
const WIN2   = mat(0xffcf78, 2, 0.06);  // bright hall window
const WINDK  = mat(0x1a2034, 1, 0.05);  // unlit window
const GRASS  = mat(0x3b5a2d, 1, 0.10);
const GRASS2 = mat(0x2f4b27, 1, 0.10);
const DIRT   = mat(0x5a4532, 1, 0.08);
const ROCK   = mat(0x5d5852, 1, 0.09);
const ROCK2  = mat(0x4a4540, 1, 0.09);
const ROCK3  = mat(0x6e675e, 1, 0.08);
const UNDER  = mat(0x3a332e, 1, 0.10);
const WATER  = mat(0x1c3f78, 3, 0.03);
const GLASS  = mat(0x86c7b4, 4, 0.04);
const WOOD   = mat(0x5a3b22, 1, 0.08);
const WOOD2  = mat(0x7b5534, 1, 0.08);
const LEAF   = mat(0x1f3b26, 1, 0.12);
const LEAF2  = mat(0x2b4b2b, 1, 0.12);
const LEAF3  = mat(0x162c1e, 1, 0.12);
const TRUNK  = mat(0x3a2a1b, 1, 0.08);
const LANT   = mat(0xffcf6b, 2, 0.05);  // lanterns / torches
const PATH   = mat(0x7a7062, 1, 0.08);
const SAND   = mat(0x8a7b5f, 1, 0.07);
const GOLD   = mat(0xd4a93a, 1, 0.05);
const RED    = mat(0x8e1f1f, 1, 0.05);
const GREENH = mat(0x1f6b3a, 1, 0.05);
const BLUEH  = mat(0x23408e, 1, 0.05);
const YELL   = mat(0xc9a227, 1, 0.05);
const PUMPK  = mat(0xd9731c, 1, 0.08);
const PALEST = mat(0x9b978f, 1, 0.08);  // stone-circle monoliths
const CLOCK  = mat(0xe8dcb0, 2, 0.02);
const TRAINR = mat(0x9b1b1b, 1, 0.04);
const BLACK  = mat(0x1b1b20, 1, 0.04);
const CARB   = mat(0x6d9cc2, 1, 0.04);  // Ford Anglia blue
const PLANT  = mat(0x3f7a3a, 1, 0.14);
const MOSS   = mat(0x46552f, 1, 0.10);
const FOAM   = mat(0x9fc3e8, 3, 0.05);
const CANDLE = mat(0xfff1c4, 2, 0.02);
const SQUID  = mat(0x3d2c44, 1, 0.08);
const IRON   = mat(0x2b2b31, 1, 0.05);
const CRYST  = mat(0x6fb6ff, 2, 0.10);  // glowing crystals under the island
const GRAVEL = mat(0x6b6357, 1, 0.08);

// ============================================================================
// 3. NOISE / RNG
// ============================================================================
function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, 0, zi), b = hash(xi + 1, 0, zi), c = hash(xi, 0, zi + 1), d = hash(xi + 1, 0, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f + i * 17.3, z * f - i * 9.1); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rand = mulberry32(19910731);
const rr = (a, b) => a + rand() * (b - a);
const ri = (a, b) => Math.floor(rr(a, b + 1));
const mod = (a, n) => ((a % n) + n) % n;

// ============================================================================
// 4. PRIMITIVES
// ============================================================================
const isSolid = m => m !== 0 && PAL[m].kind <= 2;

function box(x0, y0, z0, x1, y1, z1, m) {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++)
    set(x, y, z, typeof m === 'function' ? m(x, y, z) : m);
}
function disk(cx, cz, r, y, m) {
  const r2 = (r + 0.5) ** 2;
  for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++)
    if (dx * dx + dz * dz <= r2) set(cx + dx, y, cz + dz, typeof m === 'function' ? m(cx + dx, y, cz + dz) : m);
}
function cyl(cx, cz, r, y0, y1, m) { for (let y = y0; y <= y1; y++) disk(cx, cz, r, y, m); }

// Fill downward from y until something solid is hit (foundations, pillars).
function dropFill(x, y, z, m, maxDepth = 60) {
  for (let i = 0; i < maxDepth && y >= 0; i++, y--) { const c = get(x, y, z); if (isSolid(c)) break; set(x, y, z, m); }
}

// Oriented rasteriser: iterate world columns covered by a rotated rectangle,
// giving local coords u (along length) / v (across). ang in radians.
function oriented2D(cx, cz, ang, hl, hw, fn) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const ex = Math.ceil(Math.abs(hl * c) + Math.abs(hw * s)) + 1;
  const ez = Math.ceil(Math.abs(hl * s) + Math.abs(hw * c)) + 1;
  const bx = Math.round(cx), bz = Math.round(cz);
  for (let x = bx - ex; x <= bx + ex; x++) for (let z = bz - ez; z <= bz + ez; z++) {
    const dx = x - cx, dz = z - cz;
    const u = Math.round(dx * c + dz * s + 1e-6), v = Math.round(-dx * s + dz * c + 1e-6);
    if (u < -hl || u > hl || v < -hw || v > hw) continue;
    fn(x, z, u, v);
  }
}
function oriented(cx, cz, ang, hl, hw, y0, y1, f) {
  oriented2D(cx, cz, ang, hl, hw, (x, z, u, v) => {
    for (let y = y0; y <= y1; y++) { const m = f(u, v, y); if (m) set(x, y, z, m); }
  });
}
function toWorld(cx, cz, ang, u, v) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [Math.round(cx + u * c - v * s), Math.round(cz + u * s + v * c)];
}
// Line of voxels (Bresenham-ish in 3D via sampling).
function line3(x0, y0, z0, x1, y1, z1, m, r = 0) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)) * 1.5) + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t), z = Math.round(z0 + (z1 - z0) * t);
    if (r) box(x - r, y - r, z - r, x + r, y + r, z + r, m); else set(x, y, z, m);
  }
}
const tick = () => new Promise(r => setTimeout(r, 0));
