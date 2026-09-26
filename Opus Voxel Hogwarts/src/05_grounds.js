
// ============================================================================
// 8. GROUNDS — forest, pitch, Hagrid, willow, stone circle, lake life, train
// ============================================================================
const isGreen = m => m === GRASS || m === GRASS2 || m === MOSS;
function surf(x, z) { // highest solid voxel in column (after buildings)
  for (let y = H - 1; y >= 0; y--) if (isSolid(get(x, y, z))) return y; return -1;
}

function pine(x, z, b, h) {
  for (let y = b; y < b + 3; y++) set(x, y, z, TRUNK);
  for (let k = 2; k <= h; k++) {
    const f = 1 - (k - 2) / (h - 1), r = 0.4 + f * h * 0.3 + (mod(k, 2) ? 0.6 : 0);
    const n = Math.ceil(r);
    for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++)
      if (dx * dx + dz * dz <= r * r + 0.3 && hash(x + dx, b + k, z + dz) > 0.08)
        set(x + dx, b + k, z + dz, hash(dx, k, dz + x) < 0.5 ? LEAF3 : LEAF);
  }
  set(x, b + h + 1, z, LEAF3);
}
function oak(x, z, b, h) {
  const th = Math.max(2, Math.floor(h * 0.45));
  for (let y = b; y < b + th; y++) set(x, y, z, TRUNK);
  const r = h * 0.38, cy = b + th + r * 0.6, n = Math.ceil(r) + 1;
  for (let dy = -n; dy <= n; dy++) for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) {
    const d = (dx * dx + dz * dz) / (r * r) + (dy * dy) / (r * r * 0.55);
    if (d <= 1 && hash(x + dx, Math.round(cy) + dy, z + dz) > 0.12 + d * 0.15)
      set(x + dx, Math.round(cy + dy), z + dz, hash(dx, dy, dz + z) < 0.4 ? LEAF2 : LEAF);
  }
}
function bush(x, z, b) {
  for (let dy = 0; dy < 2; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
    if (hash(x + dx, b + dy, z + dz) < (dy ? 0.45 : 0.8) && !isSolid(get(x + dx, b + dy, z + dz))) set(x + dx, b + dy, z + dz, hash(x, dy, z) < 0.5 ? LEAF : LEAF3);
}
function flatten(cx, cz, rx, rz, y, top = GRASS) {
  for (let z = cz - rz; z <= cz + rz; z++) for (let x = cx - rx; x <= cx + rx; x++) {
    if (topY[TI(x, z)] < 0) continue;
    dropFill(x, y, z, DIRT); set(x, y, z, top);
    for (let k = y + 1; k < y + 25; k++) if (PAL[get(x, k, z)]?.kind === 1 && get(x, k, z) !== STONE && get(x, k, z) !== STONE2) setAir(x, k, z);
    topY[TI(x, z)] = y;
  }
}
function pathLine(pts, w = 1) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], n = Math.ceil(Math.hypot(bx - ax, bz - az) * 2);
    for (let j = 0; j <= n; j++) {
      const x0 = Math.round(ax + (bx - ax) * j / n), z0 = Math.round(az + (bz - az) * j / n);
      for (let dz = -w; dz <= w; dz++) for (let dx = -w; dx <= w; dx++) {
        if (Math.abs(dx) + Math.abs(dz) > w) continue;
        const x = x0 + dx, z = z0 + dz, y = surf(x, z);
        if (y > 0 && isGreen(get(x, y, z))) set(x, y, z, hash(x, 5, z) < 0.5 ? PATH : GRAVEL);
      }
    }
  }
}

function buildGrounds() {
  // ---------------- Quidditch pitch on the north-west tier ----------------
  const qx = PX(800), qz = PZ(330), qy = BASE_Y + 18;
  for (let z = qz - 16; z <= qz + 16; z++) for (let x = qx - 26; x <= qx + 26; x++) {
    const e = ((x - qx) / 24) ** 2 + ((z - qz) / 13) ** 2;
    if (e > 1.15) continue;
    for (let k = qy + 1; k < qy + 20; k++) if (get(x, k, z) && get(x, k, z) !== STONE && get(x, k, z) !== STONE2 && get(x, k, z) !== STONE3) setAir(x, k, z);
    set(x, qy, z, e > 0.92 ? SAND : (mod(Math.floor((x - qx) / 3), 2) ? GRASS : GRASS2));
    if (Math.abs(e - 0.18) < 0.03) set(x, qy, z, PALEST);
  }
  for (const sx of [-1, 1]) for (const [dz, hh] of [[-4, 9], [0, 12], [4, 9]]) {
    const x = qx + sx * 20, z = qz + dz;
    box(x, qy + 1, z, x, qy + hh, z, GOLD);
    for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; set(x, qy + hh + 2 + Math.round(Math.sin(t) * 2), z + Math.round(Math.cos(t) * 2), GOLD); }
  }
  const HOUSE = [RED, GREENH, BLUEH, YELL];
  let hi = 0;
  for (const sz of [-1, 1]) for (let x = qx - 16; x <= qx + 16; x += 8) {
    const z = qz + sz * 15, hh = 10 + (hi % 3) * 2, col = HOUSE[hi++ % 4];
    box(x - 1, qy + 1, z - 1, x + 1, qy + hh, z + 1, (x2, y, z2) => (y - qy) % 4 === 0 ? WOOD : (y > qy + hh - 4 ? col : WOOD2));
    for (let k = 0; k < 4; k++) box(x - 1 + (k > 1 ? 1 : 0), qy + hh + 1 + k, z - 1 + (k > 1 ? 1 : 0), x + 1 - (k > 1 ? 1 : 0), qy + hh + 1 + k, z + 1 - (k > 1 ? 1 : 0), k === 3 ? GOLD : col);
    box(x + 2, qy + 1, z - 1, x + 5, qy + 3, z + 1, (x2, y, z2) => (sz * (z2 - z) + (y - qy)) > 1 ? 0 : WOOD2);
  }

  // ---------------- Hagrid's hut ----------------
  {
    const x = 50, z = 190, b = surf(x, z) + 1;
    flatten(x, z, 7, 7, b - 1);
    cyl(x, z, 4, b, b + 4, (xx, y, zz) => hash(xx, y, zz) < 0.5 ? PALEST : STONE);
    for (let k = 0; k < 6; k++) disk(x, z, 5.2 - k, b + 5 + k, k === 0 ? WOOD : WOOD2);
    box(x + 4, b, z, x + 4, b + 2, z, WOOD); set(x - 4, b + 2, z, WIN); set(x, b + 2, z + 4, WIN); set(x, b + 2, z - 4, WIN);
    box(x - 2, b + 4, z - 3, x - 2, b + 11, z - 3, STONE2);
    for (let i = 0; i < 9; i++) { const px = x + 6 + (i % 3) * 2, pz = z - 3 + Math.floor(i / 3) * 3; set(px, b, pz, PUMPK); if (i % 2) set(px, b + 1, pz, PUMPK); set(px, b + (i % 2 ? 2 : 1), pz, GRASS2); }
    for (let k = -7; k <= 7; k++) { set(x + 11, b, z + k, WOOD); set(x + 11, b + 1, z + k, mod(k, 2) ? WOOD : 0); }
    lampPost(x + 5, z + 4, b); LIGHTS.warm.push([x + 6, b + 4, z + 3, 0.9]);
  }

  // ---------------- Stone circle ----------------
  {
    const x = 30, z = 160, b = surf(x, z) + 1;
    flatten(x, z, 8, 8, b - 1, GRASS2);
    for (let i = 0; i < 11; i++) {
      const a = i / 11 * Math.PI * 2, sx = Math.round(x + Math.cos(a) * 6), sz = Math.round(z + Math.sin(a) * 6), hh = 4 + (i % 3);
      box(sx, b, sz, sx, b + hh, sz, PALEST); if (i % 2) box(sx, b, sz + 1, sx, b + hh - 1, sz + 1, PALEST);
    }
  }

  // ---------------- Whomping Willow ----------------
  {
    const x = 72, z = 150, b = surf(x, z) + 1;
    for (let y = 0; y < 9; y++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (y < 6 || (dx + dz) % 2 === 0) set(x + dx, b + y, z + dz, TRUNK);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + 0.3, L = 7 + (i % 3);
      const mx = x + Math.cos(a) * L * 0.6, mz = z + Math.sin(a) * L * 0.6, ex = x + Math.cos(a) * L, ez = z + Math.sin(a) * L;
      line3(x, b + 8, z, Math.round(mx), b + 11, Math.round(mz), TRUNK);
      line3(Math.round(mx), b + 11, Math.round(mz), Math.round(ex), b + 5, Math.round(ez), TRUNK);
      for (let k = 0; k < 6; k++) set(Math.round(ex + (hash(i, k, 1) - 0.5) * 3), b + 4 + k, Math.round(ez + (hash(i, k, 2) - 0.5) * 3), LEAF2);
    }
  }

  // ---------------- Paths across the lower grounds ----------------
  pathLine([[PX(240) - 1, PZ(1340)], [36, 170], [30, 168], [44, 182], [50, 184]]);
  pathLine([[58, 196], [80, 205], [110, 214], [128, 222]]);

  // ---------------- Forbidden Forest & scattered trees ----------------
  const occ = new Uint8Array(W * D);
  const clearZones = [[qx, qz, 30], [50, 190, 11], [30, 160, 10], [72, 150, 6], [236, 100, 12]];
  for (let n = 0; n < 9000; n++) {
    const x = ri(4, W - 5), z = ri(4, D - 5), t = topY[TI(x, z)];
    if (t < 0 || occ[TI(x, z)]) continue;
    const y = surf(x, z); if (y !== t || !isGreen(get(x, y, z))) continue;
    if (clearZones.some(([a, b, r]) => (x - a) ** 2 + (z - b) ** 2 < r * r)) continue;
    const forest = (x < CX - 38 || (x < CX - 5 && z < CZ - 50) || (x < CX + 10 && z > CZ + 40 && lakeField(x, z) < -8))
      && t < PLAT_Y - 8 && fbm(x * 0.04 + 3, z * 0.04) > 0.33;
    const p = forest ? 0.9 : (t < PLAT_Y - 5 ? 0.06 : 0.015);
    if (rand() > p) continue;
    const h = forest ? ri(7, 15) : ri(5, 9);
    if (rand() < (forest ? 0.62 : 0.4)) pine(x, z, y + 1, h); else oak(x, z, y + 1, h);
    const rad = forest ? 3 : 4;
    for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) if (inb(x + dx, 0, z + dz)) occ[TI(x + dx, z + dz)] = 1;
  }
  // bushes clinging to cliffs and ledges
  for (let z = 2; z < D - 2; z++) for (let x = 2; x < W - 2; x++) {
    const t = topY[TI(x, z)]; if (t < LAKE_Y + 2) continue;
    const m = get(x, t, z);
    if ((m === ROCK || m === MOSS) && !get(x, t + 1, z) && hash(x, 9, z) < 0.11) bush(x, z, t + 1);
    else if (isGreen(m) && t > BASE_Y + 3 && t < PLAT_Y - 2 && !get(x, t + 1, z) && hash(x, 8, z) < 0.03) bush(x, z, t + 1);
  }

  // ---------------- Boats with candles crossing the Black Lake ----------------
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) {
    const x = 168 + i * 8 + j * 4, z = 238 + j * 7 - i * 2;
    if (get(x, LAKE_Y, z) !== WATER || get(x + 2, LAKE_Y, z + 1) !== WATER) continue;
    for (let u = -2; u <= 2; u++) for (let v = -1; v <= 1; v++) {
      set(x + u, LAKE_Y, z + v, WOOD);
      if (Math.abs(u) === 2 || Math.abs(v) === 1) set(x + u, LAKE_Y + 1, z + v, WOOD2);
    }
    set(x + 2, LAKE_Y + 2, z, IRON); set(x + 2, LAKE_Y + 3, z, CANDLE);
    if ((i + j) % 2 === 0) LIGHTS.small.push([x + 2, LAKE_Y + 4, z]);
  }
  // Giant squid tentacles
  for (let i = 0; i < 4; i++) {
    const x0 = 128 + i * 4, z0 = 256 - i * 2, dx = [1, -1, 0.6, -0.4][i], dz = [0.3, 0.6, -1, -0.8][i], L = 7 + i;
    for (let k = 0; k <= 20; k++) {
      const t = k / 20, x = Math.round(x0 + dx * L * t), z = Math.round(z0 + dz * L * t), y = Math.round(LAKE_Y - 1 + Math.sin(t * Math.PI) * (6 + i));
      box(x, y, z, x + (t < 0.5 ? 1 : 0), y, z + (t < 0.3 ? 1 : 0), SQUID);
    }
  }

  // ---------------- Hogsmeade station & the Hogwarts Express (east lower tier) ----------------
  {
    const tx = 236, z0 = 66, z1 = 132, ty = BASE_Y + 2;
    for (let z = z0; z <= z1; z++) {
      for (let x = tx - 3; x <= tx + 3; x++) { dropFill(x, ty, z, GRAVEL); set(x, ty, z, GRAVEL); for (let y = ty + 1; y < ty + 14; y++) if (PAL[get(x, y, z)]?.kind === 1) setAir(x, y, z); }
      set(tx - 1, ty + 1, z, IRON); set(tx + 1, ty + 1, z, IRON);
      if (mod(z, 2) === 0) { set(tx - 2, ty + 1, z, WOOD); set(tx + 2, ty + 1, z, WOOD); set(tx, ty + 1, z, WOOD); }
    }
    // platform
    for (let z = 88; z <= 124; z++) for (let x = tx + 4; x <= tx + 8; x++) { dropFill(x, ty + 1, z, STONE2); set(x, ty + 1, z, x === tx + 4 ? STONE3 : PATH); }
    for (let z = 90; z <= 122; z += 8) lampPost(tx + 8, z, ty + 2);
    hall({ cx: tx + 7, cz: 106, ang: Math.PI / 2, hl: 5, hw: 2, y0: ty + 2, h: 5, roofH: 4, litP: 0.9, stone: WOOD2, trim: WOOD });
    // engine
    const ey = ty + 2;
    for (let z = 70; z <= 80; z++) for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++)
      if (x * x + y * y <= 5) set(tx + x, ey + 2 + y, z, (y === -2) ? TRAINR : (z === 70 ? IRON : BLACK));
    box(tx, ey + 5, 72, tx, ey + 7, 72, BLACK); set(tx, ey + 2, 69, LANT);
    box(tx - 2, ey, 81, tx + 2, ey + 5, 85, (x, y, z) => (y === ey + 5) ? BLACK : (y === ey + 3 && (x === tx - 2 || x === tx + 2) && z === 83) ? WIN : TRAINR);
    box(tx - 2, ey, 86, tx + 2, ey + 2, 90, BLACK);
    for (let z = 71; z <= 89; z += 3) { set(tx - 2, ey - 1 + 1, z, TRAINR); set(tx + 2, ey, z, TRAINR); }
    for (let c = 0; c < 3; c++) {
      const za = 92 + c * 13, zb = za + 11;
      box(tx - 2, ey, za, tx + 2, ey + 5, zb, (x, y, z) => {
        if (y === ey + 5) return (x === tx - 2 || x === tx + 2) ? 0 : BLACK;
        if (y === ey) return BLACK;
        if ((x === tx - 2 || x === tx + 2) && (y === ey + 2 || y === ey + 3) && mod(z - za, 2) === 1 && z < zb) return WIN;
        return y === ey + 1 ? BLACK : TRAINR;
      });
    }
    LIGHTS.small.push([tx + 6, ty + 6, 100], [tx + 3, ty + 6, 115]);
  }
  // (The flying Ford Anglia is an animated object — see flyingCar in 07_scene.js.)
}
