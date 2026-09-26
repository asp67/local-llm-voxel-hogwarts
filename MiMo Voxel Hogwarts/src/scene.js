/* ============================================================
   VOXEL HOGWARTS — large night diorama, animated
   ============================================================ */
(function () {
  'use strict';

  /* ---------- palette (night, Harry Potter) ---------- */
  const P = {
    grass: 0x33662e, grass2: 0x2b5a27, grass3: 0x3b7034,
    dirt: 0x5d4030, dirt2: 0x4e3527,
    rock: 0x4a5060, rock2: 0x3c4150, rock3: 0x565d70,
    rockDark: 0x2e3240, rockDeep: 0x23262f,
    wall: 0x9b937f, wall2: 0x8b8370, wallLight: 0xaaa28c, wallDark: 0x746c5c,
    roof: 0x2c3a52, roof2: 0x222d42, roof3: 0x37476a,
    gold: 0xd4af37,
    winGlass: 0x2a4472, winGlass2: 0x223a66,
    wood: 0x4a3320, wood2: 0x5c4128, dark: 0x1a140c,
    path: 0x8d8674, path2: 0x7d7666,
    water: 0x0f3d50, water2: 0x2a7391, waterDeep: 0x0c2b38,
    sand: 0x9c8f6a,
    leaf: 0x2f6b2a, leaf2: 0x276022, leaf3: 0x387834, leaf4: 0x1f521c,
    trunk: 0x3f2e20,
    glass: 0x7fa8bc, glass2: 0x6f98ad, frame: 0xc9d4dc,
    flagRed: 0x8f2525, flagBlue: 0x24407f, flagGreen: 0x245f33, flagYellow: 0xc9a234,
    pumpkin: 0xc06a18,
    lamp: 0xffb347, winWarm: 0xffc873, winWarm2: 0xffdd9e, lantern: 0xff9d3d,
    clock: 0xf0e6cc,
    cloud: 0x9db4d4, cloud2: 0x7e95b8, cloud3: 0xc0d0e8
  };

  /* ---------- voxel store ---------- */
  const V = new Map();
  const K = (x, y, z) => (((x + 512) << 20) | ((y + 512) << 10) | (z + 512));
  const setV = (x, y, z, c) => V.set(K(x | 0, y | 0, z | 0), c >>> 0);
  const getV = (x, y, z) => V.get(K(x | 0, y | 0, z | 0));
  const hasV = (x, y, z) => V.has(K(x | 0, y | 0, z | 0));

  /* dynamic buckets (animated after load) */
  const L = { lights: [], water: [], leaves: [], flags: [], clouds: [] };
  const glow = (x, y, z, c) => { setV(x, y, z, c); L.lights.push(x, y, z, c); };

  /* deterministic hash 0..1 */
  function hash3(x, y, z) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function tone(tones, x, y, z) {
    if (!Array.isArray(tones)) return tones;
    return tones[Math.floor(hash3(x, y, z) * tones.length) % tones.length];
  }

  /* ---------- primitives ---------- */
  function box(x0, y0, z0, x1, y1, z1, c) {          // hollow shell box
    if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
    if (y0 > y1) { const t = y0; y0 = y1; y1 = t; }
    if (z0 > z1) { const t = z0; z0 = z1; z1 = t; }
    const grainy = Array.isArray(c);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          if (x !== x0 && x !== x1 && y !== y0 && y !== y1 && z !== z0 && z !== z1) continue;
          setV(x, y, z, grainy ? tone(c, x, y, z) : c);
        }
  }
  function fillBox(x0, y0, z0, x1, y1, z1, c) {      // solid fill
    if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
    if (y0 > y1) { const t = y0; y0 = y1; y1 = t; }
    if (z0 > z1) { const t = z0; z0 = z1; z1 = t; }
    const grainy = Array.isArray(c);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) setV(x, y, z, grainy ? tone(c, x, y, z) : c);
  }
  function disc(cx, cz, y, r, c) {
    const r2 = r * r, R = Math.ceil(r);
    for (let dz = -R; dz <= R; dz++)
      for (let dx = -R; dx <= R; dx++)
        if (dx * dx + dz * dz <= r2) setV(cx + dx, y, cz + dz, Array.isArray(c) ? tone(c, cx + dx, y, cz + dz) : c);
  }
  function topY(x, z) {                                // topmost solid voxel column
    for (let y = 4; y >= -130; y--) if (hasV(x, y, z)) return y;
    return null;
  }
  /* roof: ridge along X — top slab only (closed from every allowed angle) */
  function roofRidgeX(x0, x1, z0, z1, yEave, yApex, c, gableC) {
    const span = z1 - z0 + 1, half = span / 2, steps = yApex - yEave;
    for (let z = z0; z <= z1; z++) {
      const d = Math.abs(z + 0.5 - (z0 + span / 2));
      const hTop = yEave + Math.round((1 - d / half) * steps);
      for (let x = x0; x <= x1; x++) setV(x, hTop, z, tone(c, x, hTop, z));
      if (gableC !== undefined) {
        for (let y = yEave; y < hTop; y++) { setV(x0, y, z, gableC); setV(x1, y, z, gableC); }
        setV(x0, hTop, z, gableC); setV(x1, hTop, z, gableC);
      }
    }
  }
  /* roof: ridge along Z — top slab only */
  function roofRidgeZ(x0, x1, z0, z1, yEave, yApex, c, gableC) {
    const span = x1 - x0 + 1, half = span / 2, steps = yApex - yEave;
    for (let x = x0; x <= x1; x++) {
      const d = Math.abs(x + 0.5 - (x0 + span / 2));
      const hTop = yEave + Math.round((1 - d / half) * steps);
      for (let z = z0; z <= z1; z++) setV(x, hTop, z, tone(c, x, hTop, z));
      if (gableC !== undefined) {
        for (let y = yEave; y < hTop; y++) { setV(x, y, z0, gableC); setV(x, y, z1, gableC); }
        setV(x, hTop, z0, gableC); setV(x, hTop, z1, gableC);
      }
    }
  }
  /* conical spire (solid — small) */
  function cone(cx, cz, yBase, r, h, c) {
    for (let k = 0; k < h; k++) {
      const rr = r * (1 - k / h), y = yBase + k, R = Math.ceil(rr) + 1;
      for (let dz = -R; dz <= R; dz++)
        for (let dx = -R; dx <= R; dx++)
          if (dx * dx + dz * dz <= rr * rr + 0.3) setV(cx + dx, y, cz + dz, tone(c, cx + dx, y, cz + dz));
    }
  }
  /* hollow round tower with spiral windows */
  function tower(cx, cz, y0, y1, r, winEvery) {
    const r2 = r * r, R = Math.ceil(r);
    for (let y = y0; y <= y1; y++)
      for (let dz = -R; dz <= R; dz++)
        for (let dx = -R; dx <= R; dx++) {
          const d = dx * dx + dz * dz;
          if (d > r2 || d <= (r - 1.6) * (r - 1.6)) continue;
          setV(cx + dx, y, cz + dz, tone([P.wall, P.wall2, P.wallLight], cx + dx, y, cz + dz));
        }
    disc(cx, cz, y1, r, [P.wall, P.wall2]);           // cap disc under spire
    if (winEvery) {
      let idx = 0;
      for (let y = y0 + 4; y <= y1 - 3; y += winEvery, idx++) {
        const a = idx * 1.15 + 0.7;
        const px = cx + Math.round(Math.cos(a) * r), pz = cz + Math.round(Math.sin(a) * r);
        const warm = hash3(px, y, pz) < 0.8;
        for (let i = 0; i < 2; i++) {
          const aa = a + i * 0.22;
          const wx = cx + Math.round(Math.cos(aa) * r), wz = cz + Math.round(Math.sin(aa) * r);
          if (warm) { glow(wx, y, wz, P.winWarm); glow(wx, y + 1, wz, P.winWarm2); }
          else { setV(wx, y, wz, P.winGlass); setV(wx, y + 1, wz, P.winGlass2); }
        }
      }
    }
  }
  function flag(cx, cz, yTip, col) {
    for (let y = yTip + 1; y <= yTip + 5; y++) setV(cx, y, cz, 0x4a4a55);
    for (let i = 1; i <= 5; i++) {
      L.flags.push(cx + i, yTip + 5, cz, col, i);
      if (i <= 4) L.flags.push(cx + i, yTip + 4, cz, col, i);
      if (i <= 2) L.flags.push(cx + i, yTip + 3, cz, col, i);
    }
  }
  /* window rows on faces (dense, mostly warm) */
  function winRowZ(z, x0, x1, step, y0, y1, warmP) {
    for (let x = x0; x <= x1; x += step)
      for (let y = y0; y <= y1; y++) {
        const warm = hash3(x, y, z) < warmP;
        if (warm) glow(x - 1, y, z, hash3(x, y, z + 7) < 0.5 ? P.winWarm : P.winWarm2);
        else { setV(x - 1, y, z, P.winGlass); setV(x, y, z, P.winGlass2); }
        if (warm) { glow(x, y, z, P.winWarm); glow(x + 1, y, z, P.winWarm); }
        else setV(x + 1, y, z, P.winGlass);
      }
  }
  function winRowX(x, z0, z1, step, y0, y1, warmP) {
    for (let z = z0; z <= z1; z += step)
      for (let y = y0; y <= y1; y++) {
        const warm = hash3(x, y, z) < warmP;
        if (warm) { glow(x, y, z - 1, P.winWarm); glow(x, y, z, P.winWarm2); glow(x, y, z + 1, P.winWarm); }
        else { setV(x, y, z - 1, P.winGlass); setV(x, y, z, P.winGlass2); setV(x, y, z + 1, P.winGlass); }
      }
  }
  function lanternPost(x, z) {
    const y = topY(x, z);
    if (y === null) return;
    setV(x, y + 1, z, 0x3a3a44);
    setV(x, y + 2, z, 0x3a3a44);
    glow(x, y + 3, z, P.lantern);
  }
  function paved(x0, z0, x1, z1, tones, y) {
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) setV(x, y === undefined ? 0 : y, z, tone(tones, x, 0, z));
  }

  /* ============================================================
     ISLAND — massive multi-tiered floating chunk (r=100)
     ============================================================ */
  function buildIsland() {
    const bands = [
      { r: 100, y0: 0, y1: -6, s: 'cap' },
      { r: 94, y0: -7, y1: -12, s: 'groove' },
      { r: 99, y0: -13, y1: -17, s: 'ledge' },
      { r: 90, y0: -18, y1: -24, s: 'groove' },
      { r: 95, y0: -25, y1: -29, s: 'ledge' },
      { r: 84, y0: -30, y1: -36, s: 'groove' },
      { r: 89, y0: -37, y1: -41, s: 'ledge' },
      { r: 78, y0: -42, y1: -48, s: 'groove' },
      { r: 83, y0: -49, y1: -53, s: 'ledge' },
      { r: 72, y0: -54, y1: -60, s: 'groove' },
      { r: 77, y0: -61, y1: -65, s: 'ledge' },
      { r: 66, y0: -66, y1: -72, s: 'groove' },
      { r: 71, y0: -73, y1: -77, s: 'ledge' },
      { r: 60, y0: -78, y1: -84, s: 'groove' },
      { r: 64, y0: -85, y1: -89, s: 'ledge' },
      { r: 54, y0: -90, y1: -96, s: 'deep' },
      { r: 46, y0: -97, y1: -103, s: 'deep' },
      { r: 38, y0: -104, y1: -109, s: 'deep' },
      { r: 30, y0: -110, y1: -114, s: 'deep' },
      { r: 22, y0: -115, y1: -118, s: 'deep' },
      { r: 14, y0: -119, y1: -121, s: 'deep' },
      { r: 7, y0: -122, y1: -124, s: 'deep' }
    ];
    for (const b of bands) {
      const r2 = b.r * b.r, inner = (b.r - 2) * (b.r - 2);
      const yTop = Math.max(b.y0, b.y1), yBot = Math.min(b.y0, b.y1);
      for (let y = yBot; y <= yTop; y++)                   // 2-thick side ring
        for (let dz = -b.r; dz <= b.r; dz++)
          for (let dx = -b.r; dx <= b.r; dx++) {
            const d = dx * dx + dz * dz;
            if (d > r2 || d <= inner) continue;
            let c;
            if (b.s === 'cap') c = y === 0 ? tone([P.grass, P.grass2, P.grass3], dx, y, dz) : tone([P.dirt, P.dirt2], dx, y, dz);
            else if (b.s === 'ledge') c = tone([P.rock, P.rock3, P.wallDark], dx, y, dz);
            else if (b.s === 'groove') c = tone([P.rock2, P.rockDark], dx, y, dz);
            else c = tone([P.rockDark, P.rockDeep, P.rock2], dx, y, dz);
            setV(dx, y, dz, c);
          }
      for (let dz = -b.r; dz <= b.r; dz++)                   // full top 2 layers
        for (let dx = -b.r; dx <= b.r; dx++) {
          if (dx * dx + dz * dz > r2) continue;
          for (const yy of [yTop, yTop - 1]) {
            let c;
            if (b.s === 'cap') c = yy === 0 ? tone([P.grass, P.grass2, P.grass3], dx, yy, dz) : tone([P.dirt, P.dirt2], dx, yy, dz);
            else if (b.s === 'ledge') c = tone([P.rock, P.rock3, P.wallDark], dx, yy, dz);
            else if (b.s === 'groove') c = tone([P.rock2, P.rockDark], dx, yy, dz);
            else c = tone([P.rockDark, P.rockDeep, P.rock2], dx, yy, dz);
            setV(dx, yy, dz, c);
          }
        }
    }
    // stalactite spikes under the tip
    for (const [sx, sz, h] of [[0, 0, 6], [3, -2, 4], [-3, 2, 4], [1, 3, 3]])
      for (let k = 1; k <= h; k++)
        disc(sx, sz, -124 - k, Math.max(0.4, 3.5 - k * 0.55), tone([P.rockDark, P.rockDeep], sx, k, sz));
    // hanging greenery + rocks on the ledge rings
    for (const [lr, ly] of [[99, -13], [95, -25], [89, -37], [83, -49], [77, -61], [71, -73], [64, -85]]) {
      const n = Math.floor(lr / 3);
      for (let i = 0; i < n; i++) {
        const a = hash3(i, ly, 7) * Math.PI * 2;
        const rr = lr - 1 - hash3(i, ly, 9) * 4;
        const x = Math.round(Math.cos(a) * rr), z = Math.round(Math.sin(a) * rr);
        if (hash3(i, ly, 11) < 0.55) {
          setV(x, ly + 1, z, tone([P.leaf, P.leaf2, P.leaf4], x, ly, z));
          if (hash3(i, ly, 13) < 0.5) setV(x + 1, ly + 1, z, tone([P.leaf2, P.leaf3], x, ly, z));
        } else setV(x, ly + 1, z, tone([P.rock3, P.rock2], x, ly, z));
      }
    }
  }

  /* ============================================================
     THE BLACK LAKE — a deep bay cutting into the island's SE rim,
     so the castle grounds read as a cliffed peninsula beside water
     ============================================================ */
  const LAKE = { x: 78, z: 66, r: 42 };
  function buildLake() {
    const R = LAKE.r + 4;
    for (let dz = -R; dz <= R; dz++)
      for (let dx = -R; dx <= R; dx++) {
        const x = LAKE.x + dx, z = LAKE.z + dz;
        if (x * x + z * z > 100 * 100) continue;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d <= LAKE.r) {
          for (let y = 0; y >= -5; y--) del2(x, y, z);        // carve the basin
          for (let y = -6; y >= -12; y--) setV(x, y, z, tone([P.rock, P.rock2, P.rock3], x, y, z));
          L.water.push(x, -5, z);                              // animated water surface
        } else if (d <= LAKE.r + 3) {
          /* solid cliff band + beach ring around the bay */
          for (let y = -1; y >= -5; y--) setV(x, y, z, tone([P.dirt, P.dirt2, P.rock], x, y, z));
          if (d <= LAKE.r + 2) setV(x, 0, z, tone([P.sand, P.path2], x, 0, z));
        }
      }
  }
  function buildShore() {
    /* boathouse on the shore west of the bay */
    box(36, 1, 28, 46, 8, 38, [P.wall, P.wall2]);
    roofRidgeX(36, 46, 28, 38, 9, 15, [P.roof, P.roof2], P.wall2);
    box(36, 1, 32, 36, 4, 34, P.dark);                          // door on the west face
    glow(37, 3, 30, P.winWarm); glow(45, 3, 30, P.winWarm); glow(41, 5, 38, P.winWarm);

    /* jetty footprint: drop the water there, raise basin to meet the deck */
    for (let i = L.water.length - 3; i >= 0; i -= 3) {
      const wx = L.water[i], wz = L.water[i + 2];
      if (wx >= 43 && wx <= 60 && wz >= 41 && wz <= 45) {
        L.water.splice(i, 3);
        setV(wx, -5, wz, tone([P.rock2, P.rockDark], wx, -5, wz));
      }
    }
    /* steps cut down through the shore cliff */
    for (let x = 43; x <= 48; x++)
      for (let z = 41; z <= 45; z++)
        if (Math.hypot(x - LAKE.x, z - LAKE.z) <= LAKE.r + 3)
          for (let y = -1; y >= -4; y--) del2(x, y, z);
    fillBox(43, -4, 41, 44, -1, 45, [P.path2, P.wallDark]);
    fillBox(45, -4, 41, 46, -2, 45, [P.path2, P.wallDark]);
    fillBox(47, -4, 41, 48, -3, 45, [P.wood, P.wood2]);
    fillBox(49, -4, 41, 60, -4, 45, [P.wood, P.wood2]);          // deck at waterline
    lanternPost(59, 43);
    setV(42, 0, 44, tone([P.path, P.path2], 42, 0, 44));        // path meets the steps

    /* lantern boats moored in the bay */
    for (const [bx, bz] of [[52, 52], [64, 58], [56, 68]]) {
      fillBox(bx, -4, bz, bx + 4, -4, bz + 2, [P.wood, P.wood2]);
      del2(bx + 2, -4, bz + 1);
      setV(bx + 4, -3, bz + 1, 0x3a3a44);
      glow(bx + 4, -2, bz + 1, P.lamp);
    }

    /* paths: terrace -> boathouse -> jetty */
    paved(26, 44, 30, 47, [P.path, P.path2]);
    paved(24, 33, 35, 35, [P.path, P.path2]);
    paved(26, 35, 28, 45, [P.path, P.path2]);
  }
  function del2(x, y, z) { V.delete(K(x, y, z)); }

  /* ============================================================
     CASTLE
     ============================================================ */
  function range(x0, z0, x1, z1, h, roofApex, axis) {
    box(x0, 1, z0, x1, h, z1, [P.wall, P.wall2]);
    const eave = h + 1;
    if (axis === 'x') roofRidgeX(x0, x1, z0, z1, eave, roofApex, [P.roof, P.roof2, P.roof3], P.wall2);
    else roofRidgeZ(x0, x1, z0, z1, eave, roofApex, [P.roof, P.roof2, P.roof3], P.wall2);
  }

  function buildCastle() {
    /* lamp posts lining the approach to the great terrace */
    for (let z = 48; z <= 58; z += 3) { lanternPost(-9, z); lanternPost(9, z); }
    for (let x = -26; x <= 26; x += 6) lanternPost(x, 57);

    /* ----- central courtyard ranges ----- */
    paved(-22, -30, 20, -1, [P.path, P.path2, P.path, P.wallDark]);
    range(-24, -38, 22, -31, 16, 26, 'x');                     // north
    range(-24, -31, -19, 0, 16, 26, 'z');                      // west
    range(17, -31, 22, 0, 16, 26, 'z');                        // east
    range(-24, 1, 22, 7, 16, 26, 'x');                          // south
    winRowZ(-38, -20, 18, 4, 5, 12, 0.8);
    winRowZ(-31, -18, 16, 5, 5, 11, 0.7);
    winRowX(-24, -27, -3, 4, 5, 12, 0.8);
    winRowX(-19, -27, -3, 5, 5, 11, 0.7);
    winRowX(22, -27, -3, 4, 5, 12, 0.8);
    winRowX(17, -27, -3, 5, 5, 11, 0.7);
    winRowZ(7, -20, 18, 4, 5, 12, 0.8);
    winRowZ(1, -18, 16, 5, 5, 11, 0.7);
    for (const [tx, tz] of [[-24, -38], [22, -38], [-24, 7], [22, 7]]) {
      tower(tx, tz, 1, 26, 5, 5);
      cone(tx, tz, 27, 5.6, 11, [P.roof, P.roof2]);
      flag(tx, tz, 37, hash3(tx, 1, tz) < 0.5 ? P.flagGreen : P.flagBlue);
    }
    /* courtyard fountain */
    disc(0, -14, 1, 5, P.wallLight);
    disc(0, -14, 1, 4, 0x1f6c8f);
    box(-1, 2, -15, 0, 7, -14, P.wallLight);
    glow(0, 8, -15, P.lamp); glow(-1, 8, -14, P.lamp);
    for (const [lx, lz] of [[-14, -24], [14, -24], [-14, -4], [14, -4]]) lanternPost(lx, lz);

    /* ----- GREAT HALL ----- */
    const gx0 = -18, gx1 = 18, gz0 = 8, gz1 = 44;
    box(gx0, 1, gz0, gx1, 22, gz1, [P.wall, P.wall2]);
    for (let z = gz0 + 5; z <= gz1 - 5; z += 6) {
      for (let y = 7; y <= 19; y++) {
        glow(gx0, y, z, P.winWarm); glow(gx0, y, z - 1, P.winWarm2); glow(gx0, y, z + 1, P.winWarm);
        glow(gx1, y, z, P.winWarm); glow(gx1, y, z - 1, P.winWarm2); glow(gx1, y, z + 1, P.winWarm);
      }
    }
    roofRidgeZ(gx0, gx1, gz0, gz1, 23, 38, [P.roof, P.roof2, P.roof3], P.wall);
    for (let z = gz0; z <= gz1; z++) { setV(0, 38, z, P.gold); setV(-1, 38, z, P.roof2); setV(1, 38, z, P.roof2); }
    /* south gable: rose window + grand door */
    for (let dy = -7; dy <= 7; dy++)
      for (let dx = -7; dx <= 7; dx++)
        if (dx * dx + dy * dy <= 49) glow(dx, 30 + dy, gz1, hash3(dx, dy, 3) < 0.7 ? P.winWarm : P.winWarm2);
    fillBox(-4, 1, gz1, 4, 10, gz1, P.wood);
    glow(-3, 6, gz1, P.lamp); glow(3, 6, gz1, P.lamp);
    fillBox(-5, 11, gz1, 5, 11, gz1, P.gold);
    /* buttresses */
    for (const bz of [14, 22, 30, 38]) {
      box(gx0 - 2, 1, bz - 1, gx0 - 1, 20, bz + 1, P.wallDark);
      box(gx1 + 1, 1, bz - 1, gx1 + 2, 20, bz + 1, P.wallDark);
      glow(gx0 - 2, 21, bz, P.lamp); glow(gx1 + 2, 21, bz, P.lamp);
    }
    /* hall corner turrets */
    for (const [tx, tz] of [[-18, 8], [18, 8], [-18, 44], [18, 44]]) {
      tower(tx, tz, 1, 27, 4, 5);
      cone(tx, tz, 28, 4.6, 11, [P.roof, P.roof2]);
      flag(tx, tz, 38, P.flagYellow);
    }
    paved(-8, 45, 8, 45, [P.path2, P.path]);

    /* ----- keep + great spire (north) ----- */
    box(-13, 1, -56, 13, 30, -40, [P.wall, P.wall2]);
    for (let x = -13; x <= 13; x += 3) { setV(x, 31, -56, P.wallLight); setV(x, 31, -40, P.wallLight); }
    for (let z = -56; z <= -40; z += 3) { setV(-13, 31, z, P.wallLight); setV(13, 31, z, P.wallLight); }
    winRowZ(-56, -10, 10, 5, 8, 26, 0.85);
    winRowZ(-40, -10, 10, 5, 8, 26, 0.85);
    winRowX(-13, -53, -43, 5, 8, 26, 0.85);
    winRowX(13, -53, -43, 5, 8, 26, 0.85);
    tower(0, -48, 1, 52, 8, 4);
    cone(0, -48, 53, 8.8, 22, [P.roof, P.roof2, P.roof3]);
    flag(0, -48, 74, P.flagRed);
    for (const [sx, sz] of [[-11, -54], [11, -54], [-11, -42], [11, -42]]) {
      tower(sx, sz, 1, 40, 4, 6);
      cone(sx, sz, 41, 4.6, 13, [P.roof, P.roof2]);
      flag(sx, sz, 53, P.flagBlue);
    }

    /* ----- great towers ----- */
    tower(-44, -48, 1, 58, 6, 4);                            // astronomy
    cone(-44, -48, 59, 6.8, 16, [P.roof, P.roof2, P.roof3]);
    flag(-44, -48, 74, P.flagBlue);

    tower(44, -46, 1, 50, 6, 4);                             // east great tower
    cone(44, -46, 51, 6.8, 15, [P.roof, P.roof2, P.roof3]);
    flag(44, -46, 65, P.flagGreen);

    tower(-40, -20, 1, 40, 5, 4);                            // gryffindor
    cone(-40, -20, 41, 5.6, 14, [P.roof, P.roof2]);
    flag(-40, -20, 54, P.flagRed);

    tower(-34, 14, 1, 44, 4.5, 5);                           // bell tower
    cone(-34, 14, 45, 5.2, 15, [P.roof, P.roof2]);
    flag(-34, 14, 59, P.flagYellow);

    /* ----- clock tower (square) ----- */
    box(26, 1, 8, 36, 34, 18, [P.wall, P.wall2]);
    winRowX(26, 11, 15, 4, 6, 22, 0.8);
    winRowX(36, 11, 15, 4, 6, 22, 0.8);
    /* glowing clock faces on all four faces (tower x26..36, z8..18, centre 31/13) */
    function clockFace(set) {
      for (let a = -2; a <= 2; a++)
        for (let b = -2; b <= 2; b++) {
          const border = Math.abs(a) === 2 || Math.abs(b) === 2;
          set(a, b, border ? P.gold : P.clock);
        }
    }
    clockFace((a, b, c) => glow(31 + a, 28 + b, 18, c));
    clockFace((a, b, c) => glow(31 + a, 28 + b, 8, c));
    clockFace((a, b, c) => glow(36, 28 + b, 13 + a, c));
    clockFace((a, b, c) => glow(26, 28 + b, 13 + a, c));
    /* stepped pyramidal roof */
    for (let k = 0; k <= 10; k++) fillBox(26 + k, 35 + k, 8 + k, 36 - k, 35 + k, 18 - k, [P.roof, P.roof2]);
    setV(31, 46, 13, P.gold); glow(31, 47, 13, P.lamp);

    /* ----- east wing courtyard + library ----- */
    paved(26, -18, 50, -2, [P.path, P.path2]);
    range(26, -18, 30, -2, 14, 22, 'z');
    range(44, -18, 50, -2, 15, 24, 'z');
    winRowX(26, -15, -5, 4, 5, 11, 0.75);
    winRowX(50, -15, -5, 4, 5, 11, 0.75);
    tower(35, -10, 1, 36, 5, 5);                             // courtyard tower
    cone(35, -10, 37, 5.6, 14, [P.roof, P.roof2]);
    flag(35, -10, 50, P.flagBlue);
    tower(46, 4, 1, 30, 4, 6);
    cone(46, 4, 31, 4.6, 12, [P.roof, P.roof2]);
    for (const [lx, lz] of [[28, -16], [48, -16], [28, -4], [48, -4]]) lanternPost(lx, lz);

    /* ----- classrooms west ----- */
    range(-50, -30, -44, -6, 14, 22, 'z');
    winRowX(-50, -27, -9, 4, 5, 11, 0.75);
    paved(-44, -30, -40, -6, [P.path, P.path2]);
    tower(-47, 2, 1, 26, 4, 6);
    cone(-47, 2, 27, 4.6, 11, [P.roof, P.roof2]);

    /* ----- greenhouse (east, inside wall) ----- */
    box(34, 1, -34, 52, 8, -22, P.glass);
    fillBox(35, 1, -33, 51, 1, -23, P.dirt);
    for (let z = -32; z <= -24; z += 2)
      for (let x = 36; x <= 50; x++)
        if (hash3(x, 9, z) < 0.8) setV(x, 2, z, hash3(x, 3, z) < 0.2 ? P.pumpkin : tone([P.leaf, P.leaf3], x, 2, z));
    for (let y = 1; y <= 8; y++) {
      for (let x = 34; x <= 52; x += 6) { setV(x, y, -34, P.frame); setV(x, y, -22, P.frame); }
      for (let z = -34; z <= -22; z += 6) { setV(34, y, z, P.frame); setV(52, y, z, P.frame); }
    }
    box(34, 9, -34, 52, 9, -22, P.frame);
    roofRidgeX(34, 52, -34, -22, 10, 16, [P.glass, P.glass2]);
    for (let z = -34; z <= -22; z += 6) { setV(34, 10, z, P.frame); setV(52, 10, z, P.frame); }
    box(34, 1, -30, 34, 5, -26, P.dark);
    glow(34, 6, -28, P.winWarm);
    paved(31, -30, 33, -26, [P.path, P.path2]);

    /* ----- paths ----- */
    paved(-6, 45, 6, 45, [P.path, P.path2]);
    paved(-6, 8, 6, 7, [P.path, P.path2]);
    paved(-40, 8, -24, 10, [P.path, P.path2]);
    paved(23, -12, 31, -10, [P.path, P.path2]);
    paved(-40, -5, -51, -3, [P.path, P.path2]);
    paved(0, -40, 0, -31, [P.path, P.path2]);
    paved(-10, -40, 10, -38, [P.path, P.path2]);

    /* ----- great terrace (front platform) ----- */
    box(-30, 1, 48, 30, 4, 60, [P.path2, P.wallDark, P.path]);
    box(-30, 5, 48, -29, 7, 60, P.wallLight);
    box(29, 5, 48, 30, 7, 60, P.wallLight);
    box(-30, 5, 48, 30, 7, 48, P.wallLight);
    box(-30, 5, 60, -7, 7, 60, P.wallLight);
    box(7, 5, 60, 30, 7, 60, P.wallLight);
    for (let x = -28; x <= 28; x += 7) { setV(x, 8, 48, P.wallLight); glow(x, 9, 48, P.lantern); }
    for (let z = 50; z <= 58; z += 4) {
      setV(-30, 8, z, P.wallLight); glow(-30, 9, z, P.lantern);
      setV(30, 8, z, P.wallLight); glow(30, 9, z, P.lantern);
    }
    /* stairs down from terrace */
    fillBox(-7, 1, 61, 7, 3, 61, [P.path2, P.path]);
    fillBox(-7, 1, 62, 7, 2, 62, [P.path2, P.path]);
    fillBox(-7, 1, 63, 7, 1, 63, [P.path2, P.path]);
    /* pavilion towers on the terrace corners */
    for (const [tx, tz] of [[-26, 52], [26, 52]]) {
      tower(tx, tz, 5, 20, 3, 5);
      cone(tx, tz, 21, 3.6, 9, [P.roof, P.roof2]);
      flag(tx, tz, 29, P.flagYellow);
    }

    /* ----- Hagrid's hut + pumpkins (west lawn) ----- */
    cylHut(-70, 16, 5);
    for (let z = 6; z <= 24; z++)
      for (let x = -80; x <= -62; x++)
        if (hash3(x, 5, z) < 0.28 && topY(x, z) === 0) setV(x, 1, z, P.pumpkin);

    /* ----- village cottages (south-west, outside the wall) ----- */
    cottage(-44, 54); cottage(-56, 60); cottage(-34, 64); cottage(-48, 68);
    paved(-44, 50, -32, 52, [P.path, P.path2]);
    paved(-32, 58, -30, 66, [P.path, P.path2]);

    /* ----- lantern path winding down the south cliff ----- */
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const a = (75 + t * 62) * Math.PI / 180;
      const r = 97 - t * 34;
      const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
      const y = topY(x, z);
      if (y === null) continue;
      /* alternating stone / lit stepping-stone forms a continuous amber chain */
      if (i % 2 === 1) glow(x, y, z, P.lantern);
      else setV(x, y, z, tone([P.path, P.path2], x, y, z));
      if (i % 3 === 0) {
        const lx = x + Math.round(Math.cos(a + 1.57) * 2), lz = z + Math.round(Math.sin(a + 1.57) * 2);
        lanternPost(lx, lz);
      }
    }
    /* landing platform at the path end */
    {
      const a = (137) * Math.PI / 180, r = 62;
      const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
      const y = topY(x, z);
      if (y !== null) {
        disc(x, z, y, 4, [P.path2, P.path]);
        lanternPost(x + 3, z); lanternPost(x - 3, z); lanternPost(x, z + 3);
      }
    }

    /* ----- skyline density: chimneys, glowing dormers, extra spires ----- */
    function chimney(cx, cz, y0, y1) {              // 1×1 column sitting on its ridge cell
      box(cx, y0, cz, cx, y1, cz, P.wallDark);
      setV(cx, y1 + 1, cz, P.rock3);
    }
    for (const cx of [-16, -2, 12]) chimney(cx, -34, 26, 31);    // north range ridge (top 25)
    for (const cx of [-16, -2, 12]) chimney(cx, 4, 27, 32);       // south range ridge (top 26)
    for (const cz of [-24, -8]) chimney(-21, cz, 26, 31);         // west range ridge (top 25)
    for (const cz of [-24, -8]) chimney(20, cz, 26, 31);          // east range ridge (top 25)
    for (const cz of [16, 28]) chimney(0, cz, 39, 44);           // great hall ridge (top 38)
    chimney(-47, -24, 22, 26); chimney(-47, -12, 22, 26);        // classrooms (top 21)
    chimney(29, -14, 22, 26); chimney(29, -6, 22, 26);            // east courtyard range (top 21)
    /* dormer lights glowing on the roof slopes */
    glow(12, 28, 16, P.winWarm); glow(12, 28, 30, P.winWarm);
    glow(-12, 28, 16, P.winWarm); glow(-12, 28, 30, P.winWarm);
    glow(6, 33, 20, P.winWarm2); glow(-6, 33, 26, P.winWarm2);
    glow(-8, 25, -34, P.winWarm); glow(8, 25, -34, P.winWarm);
    glow(-8, 26, 4, P.winWarm); glow(8, 26, 4, P.winWarm);
    glow(-21, 25, -24, P.winWarm); glow(-21, 25, -8, P.winWarm);
    glow(20, 25, -24, P.winWarm); glow(20, 25, -8, P.winWarm);
    /* two more slender spires flanking the keep */
    for (const [sx, sz, fc] of [[-30, -46, P.flagRed], [30, -46, P.flagGreen]]) {
      tower(sx, sz, 1, 34, 4.5, 5);
      cone(sx, sz, 35, 5.2, 14, [P.roof, P.roof2]);
      flag(sx, sz, 48, fc);
    }
    /* flags for the classroom + library towers */
    flag(-47, 2, 37, P.flagBlue);
    flag(46, 4, 42, P.flagYellow);
  }

  function cylHut(cx, cz, r) {
    const r2 = r * r, R = Math.ceil(r);
    for (let y = 1; y <= 7; y++)
      for (let dz = -R; dz <= R; dz++)
        for (let dx = -R; dx <= R; dx++) {
          const d = dx * dx + dz * dz;
          if (d > r2 || d <= (r - 1.5) * (r - 1.5)) continue;
          setV(cx + dx, y, cz + dz, tone([P.wallDark, P.rock3, P.wall2], cx + dx, y, cz + dz));
        }
    disc(cx, cz, 7, r, P.wallDark);
    cone(cx, cz, 8, r + 0.8, 7, [0x5b4222, 0x6b4f2a]);
    glow(cx, 4, cz + r, P.winWarm);
    setV(cx, 3, cz + r, P.dark); setV(cx, 4, cz + r, P.dark);
    box(cx + r + 1, 8, cz - 1, cx + r + 2, 15, cz, P.wallDark);   // chimney
  }
  function cottage(cx, cz) {
    box(cx - 5, 1, cz - 4, cx + 5, 8, cz + 4, [P.wall, P.wall2]);
    roofRidgeX(cx - 5, cx + 5, cz - 4, cz + 4, 9, 15, [P.roof2, P.roof], P.wall2);
    glow(cx - 3, 4, cz + 4, P.winWarm); glow(cx + 3, 4, cz + 4, P.winWarm);
    glow(cx - 5, 4, cz, P.winWarm); glow(cx + 5, 4, cz, P.winWarm2);
    fillBox(cx + 2, 1, cz - 1, cx + 3, 5, cz + 1, P.dark);
    box(cx + 4, 10, cz - 2, cx + 5, 15, cz - 1, P.wallDark);       // chimney
    lanternPost(cx - 7, cz + 3);
  }

  /* ============================================================
     NATURE — trees, willow, rocks, clouds
     ============================================================ */
  const treeSpots = [];
  function inCastleGrounds(x, z) {
    return x > -60 && x < 60 && z > -64 && z < 48;
  }
  function tree(x, z, big) {
    const c = getV(x, 0, z);
    if (c !== P.grass && c !== P.grass2 && c !== P.grass3) return false;
    if (hasV(x, 1, z)) return false;
    for (const t of treeSpots) if ((t[0] - x) * (t[0] - x) + (t[1] - z) * (t[1] - z) < (big ? 64 : 30)) return false;
    treeSpots.push([x, z]);
    const h = big ? 9 : 5 + Math.floor(hash3(x, 3, z) * 5);
    const r = big ? 6 : 2.8 + hash3(x, 4, z) * 1.8;
    for (let y = 1; y <= h; y++) setV(x, y, z, P.trunk);
    if (big) for (let y = 1; y <= h; y++) { setV(x + 1, y, z, P.trunk); setV(x, y, z + 1, P.trunk); setV(x + 1, y, z + 1, P.trunk); }
    const cy = Math.round(h + r * 0.55), R = Math.ceil(r) + 1;
    for (let dy = -R; dy <= R; dy++)
      for (let dz = -R; dz <= R; dz++)
        for (let dx = -R; dx <= R; dx++) {
          const d = Math.sqrt(dx * dx + dy * dy * 1.2 + dz * dz);
          if (d > r + (hash3(x + dx, dy * 31, z + dz) - 0.5) * 1.1) continue;
          const yy = cy + dy;
          const col = tone([P.leaf, P.leaf2, P.leaf3, P.leaf4], x + dx, dy, z + dz);
          setV(x + dx, yy, z + dz, col);
          L.leaves.push(x + dx, yy, z + dz, col);
        }
    return true;
  }
  function buildNature() {
    /* ring forest around the castle grounds */
    let placed = 0, tries = 0;
    while (placed < 72 && tries < 900) {
      tries++;
      const a = hash3(tries, 21, 7) * Math.PI * 2;
      const r = 62 + hash3(tries, 22, 8) * 30;
      const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
      if (x * x + z * z > 92 * 92) continue;
      if (inCastleGrounds(x, z)) continue;
      const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
      if (dl < LAKE.r + 5) continue;
      if (tree(x, z, false)) placed++;
    }
    /* manual accents */
    tree(24, 20, true);                                   // whomping willow
    tree(-66, -30, false); tree(-70, -22, false);
    tree(66, -30, false); tree(72, -24, false);
    /* rocks */
    for (let i = 0; i < 70; i++) {
      const a = hash3(i, 1, 7) * Math.PI * 2, rr = 40 + hash3(i, 2, 8) * 55;
      const x = Math.round(Math.cos(a) * rr), z = Math.round(Math.sin(a) * rr);
      if (x * x + z * z > 90 * 90) continue;
      if (getV(x, 0, z) === undefined) continue;
      const g = getV(x, 0, z);
      if (g !== P.grass && g !== P.grass2 && g !== P.grass3) continue;
      if (hasV(x, 1, z)) continue;
      if (hash3(x, 0, z) < 0.6) setV(x, 1, z, tone([P.rock3, P.rock2], x, 1, z));
    }
    /* clouds — true sky altitude (130..210, well above the 75-block
       spires), far-half placement so they always project above the
       island; they render in front of anything they overlap */
    for (let i = 0; i < 24; i++) {
      const a = (135 + hash3(i, 5, 1) * 180) * Math.PI / 180;
      const r = 25 + hash3(i, 6, 2) * 75;
      const cx = Math.round(Math.cos(a) * r), cz = Math.round(Math.sin(a) * r);
      const cy = 125 + Math.floor(hash3(i, 7, 3) * 35);        // 125..160: above spires, in frame
      const w = 9 + Math.floor(hash3(i, 8, 4) * 12);
      const d = 6 + Math.floor(hash3(i, 9, 5) * 9);
      const h = 2 + Math.floor(hash3(i, 10, 6) * 2);
      const sp = 0.4 + hash3(i, 11, 7) * 0.9;
      const ph = hash3(i, 12, 8) * 6.28;
      for (let y = 0; y < h; y++)
        for (let dz = -d; dz <= d; dz++)
          for (let dx = -w; dx <= w; dx++) {
            const e = (dx / w) * (dx / w) + (dz / d) * (dz / d);
            if (e > 1 + (hash3(dx, y * 7, dz) - 0.5) * 0.35) continue;
            const shrink = 1 - y * 0.28;
            if (e > shrink) continue;
            const col = y === 0 ? tone([P.cloud2, P.cloud], dx, y, dz) : tone([P.cloud, P.cloud3], dx, y, dz);
            L.clouds.push(cx + dx, cy + y, cz + dz, col, ph, sp);
          }
    }
  }

  /* ============================================================
     BUILD + MESHING
     ============================================================ */
  buildIsland();
  buildLake();
  buildCastle();
  buildShore();
  buildNature();

  /* strip dynamic voxels from the static store */
  for (let i = 0; i < L.lights.length; i += 4) V.delete(K(L.lights[i], L.lights[i + 1], L.lights[i + 2]));
  for (let i = 0; i < L.water.length; i += 3) V.delete(K(L.water[i], L.water[i + 1], L.water[i + 2]));
  for (let i = 0; i < L.leaves.length; i += 4) V.delete(K(L.leaves[i], L.leaves[i + 1], L.leaves[i + 2]));
  for (let i = 0; i < L.flags.length; i += 5) V.delete(K(L.flags[i], L.flags[i + 1], L.flags[i + 2]));

  /* cull enclosed voxels */
  const pos = [], col = [];
  const cTmp = new THREE.Color(), hsl = { h: 0, s: 0, l: 0 };
  for (const [k, c] of V) {
    const x = (k >>> 20) - 512, y = ((k >>> 10) & 1023) - 512, z = (k & 1023) - 512;
    if (V.has(K(x + 1, y, z)) && V.has(K(x - 1, y, z)) &&
        V.has(K(x, y + 1, z)) && V.has(K(x, y - 1, z)) &&
        V.has(K(x, y, z + 1)) && V.has(K(x, y, z - 1))) continue;
    pos.push(x, y, z);
    cTmp.setHex(c); cTmp.getHSL(hsl);
    const j1 = hash3(x, y, z), j2 = hash3(x + 91, y - 17, z + 41), j3 = hash3(x - 53, y + 77, z - 9);
    cTmp.setHSL((hsl.h + (j1 - 0.5) * 0.018 + 1) % 1,
      Math.min(1, Math.max(0, hsl.s + (j2 - 0.5) * 0.07)),
      Math.min(1, Math.max(0, hsl.l * (1 + (j3 - 0.5) * 0.16))));
    col.push(cTmp.r, cTmp.g, cTmp.b);
  }
  const COUNT = pos.length / 3;

  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();                          // gradient sky via CSS behind canvas

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const M = new THREE.Matrix4(), mQ = new THREE.Quaternion(), mP = new THREE.Vector3(), mS = new THREE.Vector3(1, 1, 1);
  const c1 = new THREE.Color(), c2 = new THREE.Color();

  function setMat(mesh, i, x, y, z, c, sx, sy, sz) {
    mP.set(x, y, z); mS.set(sx || 1, sy || 1, sz || 1);
    M.compose(mP, mQ, mS);
    mesh.setMatrixAt(i, M);
    if (c !== undefined) { cTmp.set(c); mesh.setColorAt(i, cTmp); }
  }

  /* static world */
  const matStatic = new THREE.MeshLambertMaterial({});
  const world = new THREE.InstancedMesh(geo, matStatic, COUNT);
  for (let i = 0; i < COUNT; i++) {
    M.makeTranslation(pos[i * 3] + 0.5, pos[i * 3 + 1] + 0.5, pos[i * 3 + 2] + 0.5);
    world.setMatrixAt(i, M);
    cTmp.setRGB(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
    world.setColorAt(i, cTmp);
  }
  world.castShadow = true; world.receiveShadow = true; world.frustumCulled = false;
  world.instanceMatrix.needsUpdate = true; if (world.instanceColor) world.instanceColor.needsUpdate = true;
  scene.add(world);

  /* leaves (sway) */
  const nLeaves = L.leaves.length / 4;
  const leaves = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({}), nLeaves);
  const leafBase = new Float32Array(nLeaves * 3), leafPh = new Float32Array(nLeaves);
  for (let i = 0; i < nLeaves; i++) {
    leafBase[i * 3] = L.leaves[i * 4] + 0.5;
    leafBase[i * 3 + 1] = L.leaves[i * 4 + 1] + 0.5;
    leafBase[i * 3 + 2] = L.leaves[i * 4 + 2] + 0.5;
    leafPh[i] = hash3(L.leaves[i * 4], L.leaves[i * 4 + 1], L.leaves[i * 4 + 2]) * 6.28;
    setMat(leaves, i, leafBase[i * 3], leafBase[i * 3 + 1], leafBase[i * 3 + 2], L.leaves[i * 4 + 3]);
  }
  leaves.castShadow = true; leaves.receiveShadow = true; leaves.frustumCulled = false;
  leaves.instanceMatrix.needsUpdate = true; if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  scene.add(leaves);

  /* water (shimmer) */
  const nWater = L.water.length / 3;
  const water = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({}), nWater);
  const waterPh = new Float32Array(nWater);
  for (let i = 0; i < nWater; i++) {
    setMat(water, i, L.water[i * 3] + 0.5, L.water[i * 3 + 1] + 0.5, L.water[i * 3 + 2] + 0.5);
    waterPh[i] = hash3(L.water[i * 3], 3, L.water[i * 3 + 2]) * 6.28;
  }
  water.receiveShadow = true; water.frustumCulled = false;
  water.instanceMatrix.needsUpdate = true;
  scene.add(water);
  c2.setHex(P.water); c1.setHex(P.water2);

  /* flags (wave) */
  const nFlags = L.flags.length / 5;
  const flags = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({}), nFlags);
  const flagBase = new Float32Array(nFlags * 3), flagPhase = new Float32Array(nFlags), flagT = new Float32Array(nFlags);
  for (let i = 0; i < nFlags; i++) {
    flagBase[i * 3] = L.flags[i * 5] + 0.5;
    flagBase[i * 3 + 1] = L.flags[i * 5 + 1] + 0.5;
    flagBase[i * 3 + 2] = L.flags[i * 5 + 2] + 0.5;
    flagPhase[i] = hash3(L.flags[i * 5], 0, L.flags[i * 5 + 2]) * 6.28;
    flagT[i] = L.flags[i * 5 + 4];
    setMat(flags, i, flagBase[i * 3], flagBase[i * 3 + 1], flagBase[i * 3 + 2], L.flags[i * 5 + 3]);
  }
  flags.castShadow = true; flags.frustumCulled = false;
  flags.instanceMatrix.needsUpdate = true; if (flags.instanceColor) flags.instanceColor.needsUpdate = true;
  scene.add(flags);

  /* window / lantern lights (flicker) */
  const nLights = L.lights.length / 4;
  const lights = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({}), nLights);
  const lightBase = new Float32Array(nLights), lightCol = new Float32Array(nLights * 3), lightPh = new Float32Array(nLights);
  for (let i = 0; i < nLights; i++) {
    setMat(lights, i, L.lights[i * 4] + 0.5, L.lights[i * 4 + 1] + 0.5, L.lights[i * 4 + 2] + 0.5, L.lights[i * 4 + 3]);
    cTmp.setHex(L.lights[i * 4 + 3]);
    lightCol[i * 3] = cTmp.r; lightCol[i * 3 + 1] = cTmp.g; lightCol[i * 3 + 2] = cTmp.b;
    lightPh[i] = hash3(L.lights[i * 4], L.lights[i * 4 + 1], L.lights[i * 4 + 2]) * 6.28;
  }
  lights.frustumCulled = false; lights.instanceMatrix.needsUpdate = true;
  if (lights.instanceColor) lights.instanceColor.needsUpdate = true;
  scene.add(lights);

  /* additive glow halos around lights */
  const halos = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false
  }), nLights);
  for (let i = 0; i < nLights; i++)
    setMat(halos, i, L.lights[i * 4] + 0.5, L.lights[i * 4 + 1] + 0.5, L.lights[i * 4 + 2] + 0.5, L.lights[i * 4 + 3], 1.5, 1.5, 1.5);
  halos.frustumCulled = false; halos.instanceMatrix.needsUpdate = true;
  if (halos.instanceColor) halos.instanceColor.needsUpdate = true;
  scene.add(halos);

  /* clouds (drift) */
  const nClouds = L.clouds.length / 6;
  const clouds = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({}), nClouds);
  const cloudBase = new Float32Array(nClouds * 3), cloudPh = new Float32Array(nClouds), cloudSp = new Float32Array(nClouds);
  for (let i = 0; i < nClouds; i++) {
    cloudBase[i * 3] = L.clouds[i * 6] + 0.5;
    cloudBase[i * 3 + 1] = L.clouds[i * 6 + 1] + 0.5;
    cloudBase[i * 3 + 2] = L.clouds[i * 6 + 2] + 0.5;
    cloudPh[i] = L.clouds[i * 6 + 4]; cloudSp[i] = L.clouds[i * 6 + 5];
    setMat(clouds, i, cloudBase[i * 3], cloudBase[i * 3 + 1], cloudBase[i * 3 + 2], L.clouds[i * 6 + 3]);
  }
  clouds.receiveShadow = false; clouds.frustumCulled = false;
  clouds.instanceMatrix.needsUpdate = true; if (clouds.instanceColor) clouds.instanceColor.needsUpdate = true;
  scene.add(clouds);

  /* ---------- night lighting: moonlight, crisp short shadows ---------- */
  scene.add(new THREE.HemisphereLight(0x3a5a8c, 0x0e141d, 0.46));
  scene.add(new THREE.AmbientLight(0x1c2740, 0.42));
  const moon = new THREE.DirectionalLight(0xa8c4ff, 1.05);
  moon.position.set(95, 185, 85);
  moon.castShadow = true;
  moon.shadow.mapSize.set(4096, 4096);
  moon.shadow.camera.left = -135; moon.shadow.camera.right = 135;
  moon.shadow.camera.top = 135; moon.shadow.camera.bottom = -135;
  moon.shadow.camera.near = 10; moon.shadow.camera.far = 520;
  moon.shadow.bias = -0.0006;
  scene.add(moon); scene.add(moon.target);
  const fill = new THREE.DirectionalLight(0x40598a, 0.3);
  fill.position.set(-80, 60, -60);
  scene.add(fill);

  /* ---------- camera: high-angle isometric ---------- */
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1600);
  const cam = {
    yaw: Math.PI * 0.25,
    elev: 0.87,                       // 50°
    dist: 700,
    frustum: 235,
    target: new THREE.Vector3(0, -14, 0)
  };
  function updateCamera() {
    const dir = new THREE.Vector3(
      Math.cos(cam.elev) * Math.cos(cam.yaw),
      Math.sin(cam.elev),
      Math.cos(cam.elev) * Math.sin(cam.yaw)
    );
    camera.position.copy(cam.target).addScaledVector(dir, cam.dist);
    camera.lookAt(cam.target);
    const f = cam.frustum / 2;
    const a = window.innerWidth / window.innerHeight;
    camera.left = -f * a; camera.right = f * a;
    camera.top = f; camera.bottom = -f;
    camera.updateProjectionMatrix();
  }

  /* ---------- controls ---------- */
  const keys = new Set();
  let dragging = 0, lastX = 0, lastY = 0;
  /* register both e.key and physical code (KeyW…) so movement survives
     layouts, and clear on focus loss so no key can ever get stuck */
  const keyIds = (e) => {
    const ids = [e.key.toLowerCase()];
    if (e.code && /^Key[A-Z]$/.test(e.code)) ids.push(e.code[3].toLowerCase());
    return ids;
  };
  window.addEventListener('keydown', (e) => {
    for (const k of keyIds(e)) keys.add(k);
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (k === 'arrowup' || k === '+' || k === '=' || k === 'pageup') cam.frustum = Math.max(14, cam.frustum * 0.92);
    if (k === 'arrowdown' || k === '-' || k === '_' || k === 'pagedown') cam.frustum = Math.min(520, cam.frustum * 1.085);
  });
  window.addEventListener('keyup', (e) => { for (const k of keyIds(e)) keys.delete(k); });
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden) keys.clear(); });
  const el = renderer.domElement;
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('pointerdown', (e) => {
    dragging = (e.button === 2 || e.button === 1 || e.shiftKey) ? 2 : 1;
    lastX = e.clientX; lastY = e.clientY;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (dragging === 1) {
      cam.yaw += dx * 0.0055;
      cam.elev = Math.max(-0.25, Math.min(1.4, cam.elev + dy * 0.0055));
    } else {
      const right = new THREE.Vector3(Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
      const fwd = new THREE.Vector3(-Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
      const s = cam.frustum * 0.0015;
      cam.target.addScaledVector(right, -dx * s);
      cam.target.addScaledVector(fwd, dy * s);
    }
  });
  el.addEventListener('pointerup', () => { dragging = 0; });
  el.addEventListener('pointercancel', () => { dragging = 0; });
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    cam.frustum = Math.max(14, Math.min(520, cam.frustum * Math.exp(e.deltaY * 0.0011)));
  }, { passive: false });
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateCamera();
  });

  /* ---------- animation loop ---------- */
  const clock = new THREE.Clock();
  const fwd = new THREE.Vector3(), fwdFlat = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), mv = new THREE.Vector3();
  let t0 = 0;
  function tick() {
    const dt = Math.min(0.05, clock.getDelta());
    const t = (t0 += dt);

    /* tree canopies sway */
    for (let i = 0; i < nLeaves; i++) {
      const ph = leafPh[i];
      const a = Math.sin(t * 1.15 + ph) * 0.42 + Math.sin(t * 0.53 + ph * 1.7) * 0.2;
      const b = Math.cos(t * 0.95 + ph) * 0.42 + Math.sin(t * 0.61 + ph * 1.3) * 0.18;
      M.makeTranslation(leafBase[i * 3] + a, leafBase[i * 3 + 1] + Math.sin(t * 1.5 + ph) * 0.1, leafBase[i * 3 + 2] + b);
      leaves.setMatrixAt(i, M);
    }
    leaves.instanceMatrix.needsUpdate = true;

    /* flags ripple */
    for (let i = 0; i < nFlags; i++) {
      const w = Math.sin(t * 7 - flagT[i] * 1.15 + flagPhase[i]) * 0.45 * (flagT[i] / 5);
      M.makeTranslation(flagBase[i * 3], flagBase[i * 3 + 1] + w, flagBase[i * 3 + 2] + w * 0.6);
      flags.setMatrixAt(i, M);
    }
    flags.instanceMatrix.needsUpdate = true;

    /* water shimmer */
    for (let i = 0; i < nWater; i++) {
      const f = 0.5 + 0.5 * Math.sin(t * 1.7 + waterPh[i] + (L.water[i * 3] + L.water[i * 3 + 2]) * 0.22);
      cTmp.setRGB(c2.r + (c1.r - c2.r) * f, c2.g + (c1.g - c2.g) * f, c2.b + (c1.b - c2.b) * f);
      water.setColorAt(i, cTmp);
    }
    if (water.instanceColor) water.instanceColor.needsUpdate = true;

    /* lights flicker gently */
    for (let i = 0; i < nLights; i++) {
      const fl = 0.86 + 0.14 * Math.sin(t * 2.4 + lightPh[i]) + 0.05 * Math.sin(t * 7.3 + lightPh[i] * 2);
      cTmp.setRGB(lightCol[i * 3] * fl, lightCol[i * 3 + 1] * fl, lightCol[i * 3 + 2] * fl);
      lights.setColorAt(i, cTmp);
    }
    if (lights.instanceColor) lights.instanceColor.needsUpdate = true;

    /* clouds drift */
    for (let i = 0; i < nClouds; i++) {
      const dx = Math.sin(t * 0.06 * cloudSp[i] + cloudPh[i]) * 12;
      const dz = Math.cos(t * 0.045 * cloudSp[i] + cloudPh[i] * 1.3) * 8;
      M.makeTranslation(cloudBase[i * 3] + dx, cloudBase[i * 3 + 1] + Math.sin(t * 0.1 + cloudPh[i]) * 1.2, cloudBase[i * 3 + 2] + dz);
      clouds.setMatrixAt(i, M);
    }
    clouds.instanceMatrix.needsUpdate = true;

    /* movement — W/S translate across the ground plane (moving along the
       view axis would be invisible: orthographic projection is invariant
       to translation on the depth axis); A/D strafe; Space/Shift rise */
    camera.getWorldDirection(fwd);
    fwdFlat.set(-Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    right.crossVectors(fwd, up).normalize();
    mv.set(0, 0, 0);
    const sp = 66 * (cam.frustum / 235) * dt;
    if (keys.has('w')) mv.addScaledVector(fwdFlat, 1);
    if (keys.has('s')) mv.addScaledVector(fwdFlat, -1);
    if (keys.has('a')) mv.addScaledVector(right, -1);
    if (keys.has('d')) mv.addScaledVector(right, 1);
    if (keys.has(' ') || keys.has('e')) mv.addScaledVector(up, 1);
    if (keys.has('shift') || keys.has('q')) mv.addScaledVector(up, -1);
    if (mv.lengthSq() > 0) cam.target.addScaledVector(mv.normalize(), sp);

    updateCamera();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  updateCamera();
  tick();

  window.__voxelStats = { voxels: V.size, drawn: COUNT, lights: nLights, water: nWater, leaves: nLeaves, clouds: nClouds };
  window.__dbg = { cam, camera, renderer };
})();