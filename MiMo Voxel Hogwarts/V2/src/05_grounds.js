/* ============================================================
   05_grounds.js — forest, Quidditch pitch, Hagrid's hut, willow,
   stone circle, boats, squid, train  (PROJECT.md §9)
   ============================================================ */

const QX = PX(800), QZ = PZ(330);          // Quidditch pitch centre (voxel)

function buildGrounds() {
  buildQuidditchPitch();
  buildHagridHut();
  buildStoneCircle();
  buildWillow();
  buildPaths();
  buildForest();
  buildCliffBushes();
  buildBoats();
  buildSquid();
  buildStation();
}

/* ---------------- Quidditch pitch ---------------- */
function buildQuidditchPitch() {
  const a = 24, b = 13, s = surf(QX, QZ);
  if (s < 0) return;

  // elliptical field with mowing stripes, centre ring, sand rim
  for (let dz = -b - 3; dz <= b + 3; dz++)
    for (let dx = -a - 3; dx <= a + 3; dx++) {
      const x = QX + dx, z = QZ + dz;
      if (x < 0 || x >= W || z < 0 || z >= D) continue;
      const t = (dx * dx) / (a * a) + (dz * dz) / (b * b);
      const g = surf(x, z);
      if (g < 0 || get(x, g, z) === PAL.WATER) continue;
      if (t <= 1) {
        set(x, g, z, (Math.floor(z / 3) % 2 === 0) ? PAL.GRASS : PAL.GRASS2);   // stripes
        const ring = (dx * dx) / 36 + (dz * dz) / 16;                            // centre ring
        if (ring > 0.55 && ring < 1.45) set(x, g, z, PAL.PATH);
      } else if (t <= 1.55) {
        set(x, g, z, PAL.SAND);                                                  // sand rim
      }
    }

  // 3 gold hoops per end (heights 9/12/9, ring r2)
  for (const sg of [1, -1]) {
    let k = 0;
    for (const zo of [-8, 0, 8]) {
      const hx = Math.round(QX + sg * 20), hz = QZ + zo;
      const hh = [9, 12, 9][k++];
      const gy = s + 1;
      for (let y = gy; y <= gy + hh - 3; y++) set(hx, y, hz, PAL.GOLD);           // pole
      const ry = gy + hh - 2;
      for (let dy = -3; dy <= 3; dy++)
        for (let dz = -3; dz <= 3; dz++) {
          const d2 = dy * dy + dz * dz;
          if (d2 <= 6.3 && d2 >= 2.2) set(hx, ry + dy, hz + dz, PAL.GOLD);       // ring
        }
    }
  }

  // 10 stand towers in rotating house colours with pyramid caps + bleachers
  const houses = [PAL.RED, PAL.GREENH, PAL.BLUEH, PAL.YELL];
  for (let i = 0; i < 10; i++) {
    const th = (i / 10) * TAU + 0.31;
    const col = houses[i % 4];
    const c = Math.cos(th), sn = Math.sin(th);
    // stepped bleachers rising away from the pitch
    for (let k = 0; k < 3; k++) {
      const ra = a + 3 + k * 2, rb = b + 3 + k * 2;
      for (let w = -2; w <= 2; w++) {
        const aa = th + w * 0.06;
        const px = Math.round(QX + Math.cos(aa) * ra);
        const pz = Math.round(QZ + Math.sin(aa) * rb);
        if (px < 1 || px >= W - 1 || pz < 1 || pz >= D - 1) continue;
        const g = surf(px, pz);
        if (g < 0) continue;
        for (let y = g + 1; y <= g + 1 + k; y++) set(px, y, pz, col);
      }
    }
    // stand tower
    const tx = Math.round(QX + c * (a + 10)), tz = Math.round(QZ + sn * (b + 8));
    if (tx < 1 || tx >= W - 1 || tz < 1 || tz >= D - 1) continue;
    const gy = surf(tx, tz);
    if (gy < 0) continue;
    for (let y = gy + 1; y <= gy + 8; y++)
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++)
          if (Math.abs(dx) + Math.abs(dz) < 2 || y <= gy + 3) set(tx + dx, y, tz + dz, col);
    // pyramid cap
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        set(tx + dx, gy + 9, tz + dz, PAL.STONE3);
    set(tx, gy + 10, tz, PAL.GOLD);
  }
}

/* ---------------- Hagrid's hut ---------------- */
function buildHagridHut() {
  const hx = 50, hz = 190;
  const s = surf(hx, hz);
  if (s < 0) return;
  const y0 = s + 1;

  // masonry plinth: the ground is lumpy here — drop the footprint down so the
  // hut never floats above a lower edge column
  for (let dz = -5; dz <= 5; dz++)
    for (let dx = -5; dx <= 5; dx++) {
      if (dx * dx + dz * dz > 21) continue;
      dropFill(hx + dx, hz + dz, y0 - 1, PAL.STONE, 14);
    }

  // round stone hut r4 h5 with a stepped thatch cone
  for (let y = y0; y <= y0 + 4; y++)
    for (let dz = -4; dz <= 4; dz++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = dx * dx + dz * dz;
        if (d > 16) continue;
        if (d <= 4 && y <= y0 + 4 && !(dx === 0 && dz === 0 && y < y0 + 4)) continue;
        set(hx + dx, y, hz + dz, d > 9 ? PAL.PALEST : PAL.STONE);
      }
  // doorway (south face)
  set(hx, y0, hz + 4, 0); set(hx, y0 + 1, hz + 4, 0);
  set(hx + 1, y0, hz + 4, 0); set(hx + 1, y0 + 1, hz + 4, 0);
  // lit windows
  set(hx + 4, y0 + 2, hz, PAL.WIN); set(hx - 4, y0 + 2, hz, PAL.WIN);
  set(hx, y0 + 2, hz - 4, PAL.WIN);
  // thatch cone
  for (let k = 0; k <= 5; k++) {
    const rr = 4.6 * (1 - k / 6);
    for (let dz = Math.ceil(-rr); dz <= rr; dz++)
      for (let dx = Math.ceil(-rr); dx <= rr; dx++)
        if (dx * dx + dz * dz <= rr * rr + 0.4)
          set(hx + dx, y0 + 5 + k, hz + dz, hash(hx + dx, k, hz + dz) < 0.3 ? PAL.PATH : PAL.WOOD2);
  }
  // chimney
  box(hx + 3, y0 + 5, hz - 2, hx + 3, y0 + 10, hz - 2, PAL.ROCK2);   // starts inside the thatch
  set(hx + 3, y0 + 11, hz - 2, PAL.BLACK);

  // pumpkin patch (3×3), fence and a lamp
  for (let dz = 6; dz <= 10; dz++)
    for (let dx = -2; dx <= 2; dx++) {
      const x = hx + dx, z = hz + dz;
      const g = surf(x, z);
      if (g < 0) continue;
      set(x, g, z, PAL.DIRT);
      if (hash(x, 2, z) < 0.34) set(x, g + 1, z, PAL.PUMPK);
    }
  for (let dx = -3; dx <= 3; dx++) {                          // fence
    for (const dz of [5, 11]) {
      const x = hx + dx, z = hz + dz;
      const g = surf(x, z);
      if (g < 0) continue;
      if (Math.abs(dx) % 2 === 0) { set(x, g + 1, z, PAL.WOOD); set(x, g + 2, z, PAL.WOOD); }
      set(x, g + 2, z, PAL.WOOD2);
    }
  }
  lampPost(hx - 6, surf(hx - 6, hz + 4) + 1, hz + 4);
  LIGHTS.push({ x: hx, y: y0 + 6, z: hz, s: 1.1 });
}

/* ---------------- Stone circle ---------------- */
function buildStoneCircle() {
  const cx = 30, cz = 160;
  const s = surf(cx, cz);
  if (s < 0) return;
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU;
    const x = Math.round(cx + Math.cos(a) * 6), z = Math.round(cz + Math.sin(a) * 6);
    const g = surf(x, z);
    if (g < 0) continue;
    const hh = 3 + (i % 3);
    for (let y = g + 1; y <= g + hh; y++) set(x, y, z, PAL.PALEST);
    if (i % 2 === 0) set(x + 1, g + 1, z, PAL.PALEST);
  }
}

/* ---------------- Whomping Willow ---------------- */
function buildWillow() {
  const wx = 72, wz = 150;
  const s = surf(wx, wz);
  if (s < 0) return;
  for (let y = s + 1; y <= s + 6; y++)                        // 2×2 trunk
    for (let dx = 0; dx <= 1; dx++)
      for (let dz = 0; dz <= 1; dz++)
        set(wx + dx, y, wz + dz, PAL.TRUNK);
  for (let i = 0; i < 9; i++) {                               // arcing branches
    const a = (i / 9) * TAU + rnd() * 0.4;
    const c = Math.cos(a), sn = Math.sin(a);
    const len = rr(6, 9);
    for (let t = 0; t <= 1.001; t += 1 / 14) {
      const px = Math.round(wx + c * (1 + t * len));
      const pz = Math.round(wz + sn * (1 + t * len));
      const py = Math.round(s + 7 + Math.sin(Math.PI * t) * 4 - t * t * 3);
      set(px, py, pz, PAL.TRUNK);
      if (t > 0.55 && hash(px, py, pz) < 0.75) {              // drooping leaves
        const lm = hash(px, 3, pz) < 0.5 ? PAL.LEAF : PAL.LEAF2;
        set(px, py - 1, pz, lm);
        if (hash(px, 4, pz) < 0.6) set(px, py - 2, pz, PAL.LEAF3);
        set(px, py + 1, pz, lm);
      }
    }
  }
  set(wx, s + 7, wz, PAL.LEAF); set(wx + 1, s + 8, wz + 1, PAL.LEAF2);
}

/* ---------------- Paths ---------------- */
function groundPath(x0, z0, x1, z1, w = 2) {
  const dx = x1 - x0, dz = z1 - z0;
  const ll = Math.sqrt(dx * dx + dz * dz) || 1;
  const nx = -dz / ll, nz = dx / ll;
  line2(x0, z0, x1, z1, (x, z) => {
    for (let j = 0; j < w; j++) {
      const off = j - (w - 1) / 2;
      const px = Math.round(x + nx * off), pz = Math.round(z + nz * off);
      const g = surf(px, pz);
      if (g > 0 && g >= LAKE_Y && solid(px, g + 1, pz) === false)
        set(px, g, pz, PAL.GRAVEL);
    }
  });
}
function buildPaths() {
  groundPath(95, 175, 30, 162, 2);      // wooden bridge → stone circle
  groundPath(42, 170, 50, 186, 2);      // circle → Hagrid's hut
  groundPath(50, 196, 66, 216, 2);      // hut → the lake
}

/* ---------------- Forbidden Forest ---------------- */
function buildForest() {
  const occ = new Uint8Array(W * D);
  const clear = (x, z) => {
    const dxq = x - QX, dzq = z - QZ;
    if ((dxq * dxq) / (28 * 28) + (dzq * dzq) / (17 * 17) <= 1) return true;   // pitch
    if ((x - 50) * (x - 50) + (z - 190) * (z - 190) < 144) return true;        // hut
    if ((x - 30) * (x - 30) + (z - 160) * (z - 160) < 100) return true;         // circle
    if ((x - 72) * (x - 72) + (z - 150) * (z - 150) < 81) return true;          // willow
    if (x >= 230 && x <= 254 && z >= 58 && z <= 138) return true;               // station
    const g = surf(x, z);
    if (g < LAKE_Y + 1) return true;                                            // water
    if (g >= PLAT_Y - 8) return true;                                           // castle plateau
    if (g > 0 && solid(x, g + 1, z)) return true;                               // walls etc.
    return false;
  };
  const plant = (x, z, sp) => {
    for (let dz = -sp; dz <= sp; dz++)
      for (let dx = -sp; dx <= sp; dx++) {
        const nx = x + dx, nz = z + dz;
        if (nx >= 0 && nx < W && nz >= 0 && nz < D) occ[nx + W * nz] = 1;
      }
  };
  const free = (x, z, sp) => {
    for (let dz = -sp; dz <= sp; dz++)
      for (let dx = -sp; dx <= sp; dx++) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
        if (occ[nx + W * nz]) return false;
      }
    return true;
  };

  let placed = 0;
  for (let i = 0; i < 9000; i++) {
    const a = rnd() * TAU, rr2 = Math.sqrt(rnd()) * (R - 4);
    const x = Math.round(CX + Math.cos(a) * rr2);
    const z = Math.round(CZ + Math.sin(a) * rr2);
    if (x < 2 || x >= W - 2 || z < 2 || z >= D - 2) continue;
    if (clear(x, z)) continue;
    const g = surf(x, z);
    const nx = (x - CX) / R, nz = (z - CZ) / R;
    const forestZone = nx < -0.2 || (nx < 0.15 && nz < -0.5) || (nx < 0.15 && nz > 0.5);
    let sp = 0, dense = false;
    if (forestZone && fbm(x * 0.03, z * 0.03) > 0.33 && rnd() < 0.9) {
      sp = 3; dense = true;
    } else if (g < GROUNDS_Y) {
      if (rnd() >= 0.06) continue;
      sp = 4;
    } else {
      if (rnd() >= 0.015) continue;
      sp = 4;
    }
    if (!free(x, z, sp)) continue;
    tree(x, z, g, dense ? rnd() < 0.55 : rnd() < 0.3);
    plant(x, z, sp);
    placed++;
  }
}

function tree(x, z, g, pine) {
  if (g < 0) return;
  if (pine) {
    const th = ri(5, 9);
    for (let y = g + 1; y <= g + th; y++) set(x, y, z, PAL.TRUNK);
    const coneH = ri(6, 10), r0 = rr(2.2, 3.2);
    const mats = [PAL.LEAF3, PAL.LEAF, PAL.LEAF2];
    for (let k = 1; k <= coneH; k++) {
      const rr2 = r0 * (1 - k / coneH) + 0.4;
      if (rr2 < 0.4) break;
      const m = mats[k % 3];
      for (let dz = Math.ceil(-rr2); dz <= rr2; dz++)
        for (let dx = Math.ceil(-rr2); dx <= rr2; dx++) {
          const d = dx * dx + dz * dz;
          if (d > rr2 * rr2 + 0.3) continue;
          if (hash(x + dx, k, z + dz) < 0.12) continue;       // ragged edges
          set(x + dx, g + th + k, z + dz, m);
        }
    }
  } else {
    const th = ri(3, 5);
    for (let y = g + 1; y <= g + th; y++) set(x, y, z, PAL.TRUNK);
    const cr = rr(2.4, 3.4);
    for (let dy = -1; dy <= Math.ceil(cr); dy++)
      for (let dz = Math.ceil(-cr); dz <= cr; dz++)
        for (let dx = Math.ceil(-cr); dx <= cr; dx++) {
          const d = (dx * dx + dz * dz) / (cr * cr) + (dy * dy) / (cr * cr * 0.8);
          if (d > 1.05) continue;
          if (hash(x + dx, dy + 3, z + dz) < 0.2) continue;    // noisy crown
          const m = hash(x + dx, dy + 7, z + dz) < 0.5 ? PAL.LEAF2 : PAL.LEAF;
          set(x + dx, g + th + dy, z + dz, m);
        }
  }
}

/* ---------------- Cliff bushes ---------------- */
function buildCliffBushes() {
  for (let z = 1; z < D - 1; z++)
    for (let x = 1; x < W - 1; x++) {
      const g = surf(x, z);
      if (g < LAKE_Y + 1) continue;
      if (g >= PLAT_Y - 8) continue;                            // not on the castle plateau
      const m = get(x, g, z);
      if (solid(x, g + 1, z)) continue;
      const rock = m === PAL.ROCK || m === PAL.ROCK2 || m === PAL.ROCK3 || m === PAL.MOSS;
      const grass = m === PAL.GRASS || m === PAL.GRASS2;
      const steepN = get(x + 1, g, z) < g - 2 || get(x - 1, g, z) < g - 2 ||
                     get(x, g, z + 1) < g - 2 || get(x, g, z - 1) < g - 2;
      let p = 0;
      if (rock && steepN) p = 0.11;
      else if (grass && g > BASE_Y && g <= GROUNDS_Y) p = 0.03;
      if (p === 0 || hash(x, 23, z) >= p) continue;
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if (hash(x + dx, 29, z + dz) < 0.2) continue;
          const lm = hash(x + dx, 31, z + dz) < 0.5 ? PAL.LEAF : PAL.LEAF2;
          set(x + dx, g + 1, z + dz, lm);
          if (hash(x + dx, 37, z + dz) < 0.55) set(x + dx, g + 2, z + dz, PAL.LEAF3);
        }
    }
}

/* ---------------- Boats with candles ---------------- */
function buildBoats() {
  const spots = [];
  for (let r2 = 0; r2 < 2; r2++)
    for (let c = 0; c < 4; c++)
      spots.push([170 + c * 9, 239 + r2 * 5]);
  for (const sp of spots) {
    const bx = sp[0], bz = sp[1];
    if (bx < 2 || bx >= W - 3 || bz < 2 || bz >= D - 3) continue;
    if (get(bx, LAKE_Y, bz) !== PAL.WATER) continue;
    // 5×3 hull
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const edge = Math.abs(dz) === 2 || Math.abs(dx) === 1;
        set(bx + dx, LAKE_Y, bz + dz, PAL.WOOD);
        if (edge) set(bx + dx, LAKE_Y + 1, bz + dz, PAL.WOOD);   // rim
        if (!edge) set(bx + dx, LAKE_Y - 1, bz + dz, PAL.WOOD);  // deck one lower
      }
    set(bx, LAKE_Y + 1, bz, PAL.WOOD);                           // candle post
    set(bx, LAKE_Y + 2, bz, PAL.CANDLE);
  }
}

/* ---------------- Giant squid ---------------- */
function buildSquid() {
  const bases = [[142, 213], [149, 216], [145, 221], [152, 212]];
  for (let i = 0; i < 4; i++) {
    const b = bases[i];
    const dir = (i / 4) * TAU + 0.8;
    const c = Math.cos(dir), sn = Math.sin(dir);
    for (let t = 0; t <= 1.001; t += 1 / 18) {
      const px = Math.round(b[0] + c * t * 7);
      const pz = Math.round(b[1] + sn * t * 7);
      const py = Math.round(LAKE_Y - 2 + Math.sin(Math.PI * t) * 6.5);
      const th = 1.7 * (1 - t * 0.75);
      for (let dy = Math.ceil(-th); dy <= th; dy++)
        for (let dz = Math.ceil(-th); dz <= th; dz++)
          for (let dx = Math.ceil(-th); dx <= th; dx++)
            if (dx * dx + dy * dy + dz * dz <= th * th + 0.4)
              set(px + dx, py + dy, pz + dz, PAL.SQUID);
    }
  }
}

/* ---------------- Hogsmeade station & the Hogwarts Express ---------------- */
function buildStation() {
  // track grade = highest ground along the corridor
  let grade = 0;
  for (let z = 66; z <= 132; z++)
    for (let x = 233; x <= 239; x++) grade = Math.max(grade, surf(x, z));
  if (grade <= 0) return;

  // gravel bed, sleepers, iron rails
  for (let z = 66; z <= 132; z++) {
    for (let x = 233; x <= 239; x++) {
      const g = surf(x, z);
      for (let y = Math.max(0, g); y <= grade; y++) set(x, y, z, PAL.GRAVEL);
      if (z % 3 === 0) set(x, grade + 1, z, PAL.WOOD2);
    }
    set(235, grade + 2, z, PAL.IRON);
    set(237, grade + 2, z, PAL.IRON);
  }

  // platform with lamps
  for (let z = 70; z <= 128; z++)
    for (let x = 240; x <= 243; x++) {
      const g = surf(x, z);
      for (let y = Math.max(0, g); y <= grade + 3; y++) set(x, y, z, PAL.STONE3);
    }
  for (const z of [74, 88, 102, 116, 126]) lampPost(241, grade + 4, z);

  // wooden station house
  {
    const hx = 249, hz = 102;
    const y0 = surf(hx, hz) + 1;
    hall({
      cx: hx, cz: hz, hl: 5, hw: 9, h: 7, y0,
      roof: 'gable', roofH: 5, ev: 3, litP: 0.9,
      stone: PAL.WOOD, trim: PAL.WOOD2, roofMat: PAL.ROOF
    });
  }

  // ---- the Hogwarts Express ----
  const gy = grade;
  // boiler + red skirt
  box(235, gy + 4, 78, 237, gy + 6, 88, PAL.BLACK);
  box(235, gy + 2, 78, 237, gy + 3, 94, PAL.TRAINR);
  // chimney with a flare, headlamp
  box(236, gy + 7, 79, 236, gy + 9, 81, PAL.BLACK);
  box(235, gy + 10, 79, 237, gy + 10, 81, PAL.BLACK);
  set(236, gy + 6, 77, PAL.CANDLE);
  // cab with lit windows + black roof
  box(235, gy + 4, 89, 237, gy + 9, 94, PAL.TRAINR);
  for (let z = 90; z <= 93; z++) { set(235, gy + 7, z, PAL.WIN); set(237, gy + 7, z, PAL.WIN); }
  box(234, gy + 10, 88, 238, gy + 10, 95, PAL.BLACK);
  // tender
  box(235, gy + 2, 95, 237, gy + 8, 101, PAL.BLACK);
  box(234, gy + 9, 95, 238, gy + 9, 101, PAL.ROCK2);
  // three carriages with lit windows and black roofs
  for (let c = 0; c < 3; c++) {
    const z0 = 103 + c * 10, z1 = z0 + 8;
    box(235, gy + 2, z0, 237, gy + 8, z1, PAL.TRAINR);
    for (let z = z0 + 1; z <= z1 - 1; z++) {
      if (hash(235, z, c) < 0.85) { set(235, gy + 6, z, PAL.WIN); set(237, gy + 6, z, PAL.WIN); }
      if (hash(235, z, c + 9) < 0.85) { set(235, gy + 7, z, PAL.WIN); set(237, gy + 7, z, PAL.WIN); }
    }
    box(234, gy + 9, z0 - 1, 238, gy + 9, z1 + 1, PAL.BLACK);
    for (let z = z0 + 1; z <= z1 - 1; z += 3) {
      set(234, gy + 2, z, PAL.BLACK); set(238, gy + 2, z, PAL.BLACK);
      set(234, gy + 1, z, PAL.BLACK); set(238, gy + 1, z, PAL.BLACK);
    }
  }
}