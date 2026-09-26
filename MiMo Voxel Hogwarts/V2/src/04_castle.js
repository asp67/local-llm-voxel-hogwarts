/* ============================================================
   04_castle.js — Hogwarts layout (PROJECT.md §8)
   All coordinates are plan px (2000 px plan, north up);
   h = wall height in voxels above PLAT_Y.
   ============================================================ */

// plan-rect → hall centred/sized in voxels
function hallRect(x0, z0, x1, z1, o) {
  return hall(Object.assign({
    cx: PX((x0 + x1) / 2), cz: PZ((z0 + z1) / 2),
    hl: Math.round((x1 - x0) * S / 2), hw: Math.round((z1 - z0) * S / 2)
  }, o));
}
// gravel / paving strip between two plan points
function strip(x0, z0, x1, z1, w, m) {
  const a = [PX(x0), PZ(z0)], b = [PX(x1), PZ(z1)];
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const ll = Math.sqrt(dx * dx + dz * dz) || 1;
  const nx = -dz / ll, nz = dx / ll;
  line2(a[0], a[1], b[0], b[1], (x, z) => {
    for (let j = 0; j < w; j++) {
      const off = j - (w - 1) / 2;
      set(Math.round(x + nx * off), PLAT_Y - 1, Math.round(z + nz * off), m);
    }
  });
}
// crenellated curtain wall (y0 = wall base; omitted → follows terrain)
function wallLine(x0, z0, x1, z1, h, w = 1, y0) {
  let i = 0;
  line2(x0, z0, x1, z1, (x, z) => {
    const base = (y0 !== undefined) ? y0 : surf(x, z);
    if (base >= 0) {
      for (let j = 0; j < w; j++)
        for (let y = base; y <= base + h - 1; y++) set(x + j, y, z, PAL.STONE2);
      if (i % 2 === 0) {
        for (let j = 0; j < w; j++) {
          set(x + j, base + h, z, PAL.STONE3);
          set(x + j, base + h + 1, z, PAL.STONE3);
        }
      }
    }
    i++;
  });
}
// fountain with a warm point light
function fountain(px, py) {
  const x = PX(px), z = PZ(py), y = PLAT_Y - 1;
  for (let dz = -4; dz <= 4; dz++)
    for (let dx = -4; dx <= 4; dx++) {
      const d = dx * dx + dz * dz;
      if (d > 16) continue;
      set(x + dx, y, z + dz, d <= 4 ? PAL.WATER : PAL.STONE3);
    }
  set(x, y + 1, z, PAL.STONE3);
  set(x, y + 2, z, PAL.WATER);
  LIGHTS.push({ x, y: y + 4, z, s: 1 });
}

function buildCastle() {
  /* ============ Greenhouse compound (NE) ============ */
  strip(1125, 570, 1460, 570, 3, PAL.GRAVEL);
  strip(1347, 450, 1347, 1015, 3, PAL.GRAVEL);
  strip(1120, 920, 1580, 920, 3, PAL.GRAVEL);
  wallLine(PX(1120), PZ(450), PX(1580), PZ(450), 6, 1, PLAT_Y - 1);
  wallLine(PX(1580), PZ(450), PX(1580), PZ(1020), 6, 1, PLAT_Y - 1);

  const greenhouses = [
    [1130, 470, 1300, 505], [1130, 530, 1300, 560],
    [1395, 470, 1560, 505], [1395, 530, 1560, 560],
    [1470, 580, 1510, 730], [1525, 580, 1565, 730],
    [1470, 745, 1510, 890], [1525, 745, 1565, 890]
  ];
  for (const g of greenhouses) greenhouse(g[0], g[1], g[2], g[3]);

  // octagonal glass pavilion with a gold finial
  {
    const x = PX(1350), z = PZ(448), y0 = PLAT_Y;
    const pr = 5;
    for (let y = y0; y <= y0 + 4; y++) {                    // glass drum walls
      for (let dz = -pr; dz <= pr; dz++)
        for (let dx = -pr; dx <= pr; dx++) {
          const d = dx * dx + dz * dz;
          if (d > pr * pr || (y > y0 && d <= (pr - 1) * (pr - 1))) continue;
          set(x + dx, y, z + dz, y === y0 ? PAL.STONE3 : PAL.GLASS);
        }
    }
    for (let k = 0; k <= 4; k++) {
      const rr = pr * (1 - k / 5);
      disk(x, z, rr, y0 + 5 + k, PAL.GLASS);
    }
    set(x, y0 + 10, z, PAL.GOLD);
    set(x, y0 + 11, z, PAL.GOLD);
    LIGHTS.push({ x, y: y0 + 6, z, s: 0.8 });
  }

  /* ============ North quadrangle ============ */
  hallRect(960, 605, 1275, 680, { h: 24, dormers: true });
  hallRect(960, 605, 1030, 915, { h: 24 });
  cloister(1032, 682, 1270, 910, 1060, 700, 1240, 880);
  fountain(1150, 790);
  lampPost(PX(1070), PLAT_Y, PZ(710));
  lampPost(PX(1230), PLAT_Y, PZ(710));
  lampPost(PX(1070), PLAT_Y, PZ(870));
  lampPost(PX(1230), PLAT_Y, PZ(870));
  LIGHTS.push({ x: PX(1060), y: PLAT_Y + 4, z: PZ(700), s: 0.7 });

  /* ============ Spine & gothic towers ============ */
  hallRect(1275, 590, 1425, 910, { h: 26, roofH: 11, buttress: 4, dormers: true });
  hallRect(1310, 905, 1390, 1150, { h: 22 });
  squareTower({ cx: PX(1280), cz: PZ(612), s: 4, h: 40, roofH: 24, win: 'gothic', pinnacles: 9 });
  squareTower({ cx: PX(1410), cz: PZ(612), s: 4, h: 40, roofH: 24, win: 'gothic', pinnacles: 9 });
  squareTower({ cx: PX(1345), cz: PZ(598), s: 3, h: 36, roofH: 34, win: 'gothic' });
  hallRect(1220, 910, 1500, 1030, { h: 24 });
  squareTower({ cx: PX(1350), cz: PZ(958), s: 6, h: 34, roofH: 16, pinnacles: true });
  hallRect(1225, 1055, 1500, 1145, { h: 22, buttress: 3 });
  roundTower({ x: PX(1215), z: PZ(1062), r: rad(30), h: 30 });
  roundTower({ x: PX(1480), z: PZ(1062), r: rad(30), h: 30 });
  roundTower({ x: PX(1215), z: PZ(1142), r: rad(36), h: 26, crenel: true, cone: false });
  roundTower({ x: PX(1480), z: PZ(1142), r: rad(36), h: 26, crenel: true, cone: false });

  /* ============ Fountain plaza ============ */
  for (let x = PX(1095); x <= PX(1220); x++)
    for (let z = PZ(905); z <= PZ(1025); z++) set(x, PLAT_Y - 1, z, PAL.STONE3);
  fountain(1157, 965);

  /* ============ West blocks ============ */
  hallRect(1000, 915, 1075, 1030, { h: 24 });
  hallRect(890, 960, 1000, 1030, { h: 20 });
  roundTower({ x: PX(945), z: PZ(1035), r: rad(55), h: 20, coneH: 13 });
  roundTower({ x: PX(897), z: PZ(960), r: 2.5, h: 27 });
  roundTower({ x: PX(1000), z: PZ(953), r: 2.5, h: 29 });
  roundTower({ x: PX(945), z: PZ(920), r: 2.5, h: 31 });
  bridge({ x0: PX(885), z0: PZ(990), x1: PX(575), z1: PZ(968), y: PLAT_Y - 1, w: 3, lanterns: 6, pierEvery: 10 });
  roundTower({ x: PX(560), z: PZ(966), r: 3, h: 10, cone: false, crenel: true });

  /* ============ NW angled wing & grounds ============ */
  hall({ cx: PX(830), cz: PZ(605), ang: -22 * DEG, hl: 11, hw: 7, h: 28, dormers: true, buttress: 3 });
  hall({ cx: PX(890), cz: PZ(700), ang: 19 * DEG, hl: 12, hw: 3, h: 20 });
  roundTower({ x: PX(848), z: PZ(745), r: 3, h: 26 });
  roundTower({ x: PX(922), z: PZ(770), r: 3, h: 24 });
  squareTower({ cx: PX(735), cz: PZ(575), ang: -22 * DEG, s: 3, h: 36, roofH: 22 });
  hall({ cx: PX(1100), cz: PZ(420), ang: -25 * DEG, hl: 7, hw: 4, h: 14 });
  roundTower({ x: PX(1155), z: PZ(405), r: 2.5, h: 20 });
  hallRect(1080, 465, 1122, 605, { h: 12 });

  // rampart following the terrain, turrets at the vertices
  const RP = [[1090, 380], [990, 190], [945, 165], [885, 140], [670, 150], [535, 345], [505, 405]];
  for (let i = 0; i < RP.length - 1; i++)
    wallLine(PX(RP[i][0]), PZ(RP[i][1]), PX(RP[i + 1][0]), PZ(RP[i + 1][1]), 6, 1);
  for (let i = 0; i < RP.length - 1; i++) {
    const x = PX(RP[i][0]), z = PZ(RP[i][1]);
    const s = surf(x, z);
    if (s > 0) roundTower({ x, z, r: 2.6, h: 12, y0: s + 1 });
  }
  // owlery at the rampart's end
  {
    const x = PX(505), z = PZ(405), s = surf(x, z);
    if (s > 0) roundTower({ x, z, r: 4.5, h: 30, coneH: 14, y0: s + 1, winN: 14, litP: 0.18 });
  }

  /* ============ Courtyard block, Clock & Astronomy towers ============ */
  hallRect(780, 1180, 1060, 1265, { h: 26, buttress: 3 });
  hallRect(780, 1180, 860, 1500, { h: 26 });
  hallRect(780, 1420, 1040, 1500, { h: 24, arches: true });
  hallRect(1040, 1235, 1120, 1420, { h: 26 });
  for (let x = PX(860); x <= PX(1040); x++)
    for (let z = PZ(1265); z <= PZ(1420); z++) set(x, PLAT_Y - 1, z, PAL.STONE3);
  fountain(950, 1340);
  lampPost(PX(880), PLAT_Y, PZ(1285));
  lampPost(PX(1020), PLAT_Y, PZ(1285));
  lampPost(PX(880), PLAT_Y, PZ(1400));
  lampPost(PX(1020), PLAT_Y, PZ(1400));
  roundTower({ x: PX(775), z: PZ(1182), r: rad(42), h: 32 });
  roundTower({ x: PX(775), z: PZ(1495), r: rad(42), h: 30 });
  roundTower({ x: PX(1105), z: PZ(1235), r: rad(45), h: 34 });
  roundTower({ x: PX(1000), z: PZ(1168), r: 2.5, h: 14 });
  roundTower({ x: PX(1065), z: PZ(1168), r: 2.5, h: 14 });
  roundTower({ x: PX(1060), z: PZ(1545), r: 2.5, h: 14 });

  // Clock Tower
  const ct = { cx: PX(795), cz: PZ(1340), s: 5, h: 44, roofH: 18, pinnacles: true };
  squareTower(ct);
  for (const sg of [1, -1])                                 // clock faces W & E at +36
    for (let dv = -3; dv <= 3; dv++)
      for (let dy = -3; dy <= 3; dy++) {
        const d2 = dv * dv + dy * dy;
        if (d2 > 9) continue;
        const w2 = toWorld(ct.cx, ct.cz, 0, sg * ct.s, dv);
        const y = PLAT_Y + 36 + dy;
        set(w2[0], y, w2[1], d2 >= 6 ? PAL.GOLD : PAL.CLOCK);
      }
  for (const sg of [1, -1]) {                               // black hands
    const face = (dv, dy) => {
      const p = toWorld(ct.cx, ct.cz, 0, sg * ct.s, dv);
      set(p[0], PLAT_Y + 36 + dy, p[1], PAL.BLACK);
    };
    face(0, 0); face(0, 1); face(0, 2);                     // vertical hand
    face(1, 0); face(2, 0);                                 // horizontal hand
  }
  LIGHTS.push({ x: ct.cx, y: PLAT_Y + 38, z: ct.cz, s: 1.2 });

  // Astronomy Tower — the tallest point
  const at = { x: PX(1100), z: PZ(1490), r: 10, h: 44, machi: true, crenel: true, coneH: 42, spire: 5 };
  roundTower(at);
  roundTower({ x: at.x - 7, z: at.z - 5, r: 1.5, h: 7, coneH: 4, y0: PLAT_Y + 41 });
  roundTower({ x: at.x - 4, z: at.z - 8, r: 1.5, h: 7, coneH: 4, y0: PLAT_Y + 41 });
  LIGHTS.push({ x: at.x, y: PLAT_Y + 47, z: at.z, s: 1.3 });

  /* ============ Clock-tower courtyard (W) & wooden bridge ============ */
  hallRect(595, 1255, 700, 1420, { h: 22, dormers: true });
  wallLine(PX(405), PZ(1240), PX(715), PZ(1240), 10, 1, PLAT_Y - 1);
  wallLine(PX(405), PZ(1435), PX(715), PZ(1435), 10, 1, PLAT_Y - 1);
  wallLine(PX(405), PZ(1240), PX(405), PZ(1320), 12, 1, PLAT_Y - 1);   // west wall with gate
  wallLine(PX(405), PZ(1360), PX(405), PZ(1435), 12, 1, PLAT_Y - 1);
  roundTower({ x: PX(425), z: PZ(1262), r: 2.5, h: 14 });
  roundTower({ x: PX(425), z: PZ(1412), r: 2.5, h: 14 });
  for (let x = PX(430); x <= PX(590); x++)
    for (let z = PZ(1265); z <= PZ(1420); z++) set(x, PLAT_Y - 1, z, PAL.STONE3);
  fountain(525, 1338);
  hallRect(700, 1334, 782, 1346, { h: 12 });                 // covered stone passage

  // covered wooden bridge west to a small tower
  bridge({ x0: PX(422), z0: PZ(1340), x1: PX(240), z1: PZ(1340), y: PLAT_Y - 1, w: 3, truss: true, roof: true, pierEvery: 6 });
  {
    // end tower reaches from its masonry pillar up to the deck level
    const x = PX(232), z = PZ(1340);
    roundTower({ x, z, r: 3, h: 10, y0: PLAT_Y - 10, cone: false, crenel: true });
  }

  /* ============ Great Hall ============ */
  {
    const gx = PX(1125), gz = PZ(1655), ga = -34.9 * DEG;
    hall({
      cx: gx, cz: gz, ang: ga, hl: 24, hw: 5, h: 28, roof: 'gable', roofH: 10,
      win: 'gothic', winMat: PAL.WIN2, litP: 0.9, buttress: 3, floorH: 7
    });
    // paved terrace two voxels around
    oriented2D(gx, gz, ga, 27, 8, (u, v, x, z) => {
      if (Math.abs(u) <= 24 && Math.abs(v) <= 5) return;
      if (inb(x, PLAT_Y - 1, z)) set(x, PLAT_Y - 1, z, PAL.STONE3);
    });
    // round stair tower at local (8,8)
    const st = toWorld(gx, gz, ga, 8, 8);
    roundTower({ x: st[0], z: st[1], r: 3, h: 34 });
    // copper flèche on the ridge
    const fl = toWorld(gx, gz, ga, 0, 0);
    for (let y = PLAT_Y + 38; y <= PLAT_Y + 43; y++)
      if (y < H) set(fl[0], y, fl[1], y >= PLAT_Y + 42 ? PAL.COPPER : PAL.ROOF2);
    // corner pinnacles at both gable ends
    for (const sgn of [1, -1])
      for (const cn of [1, -1]) {
        const p = toWorld(gx, gz, ga, sgn * 24, cn * 5);
        for (let y = PLAT_Y + 28; y < PLAT_Y + 33; y++) if (y < H) set(p[0], y, p[1], PAL.STONE3);
        if (PLAT_Y + 33 < H) set(p[0], PLAT_Y + 33, p[1], PAL.ROOF2);
        if (PLAT_Y + 34 < H) set(p[0], PLAT_Y + 34, p[1], PAL.COPPER);
      }
    LIGHTS.push({ x: gx, y: PLAT_Y + 14, z: gz, s: 1.4 });
  }

  /* ============ Bridges & stairs ============ */
  bridge({ x0: PX(1340), z0: PZ(1170), x1: PX(1250), z1: PZ(1465), y: PLAT_Y - 1, w: 3, lanterns: 5, pierEvery: 8 });
  bridge({ x0: PX(1145), z0: PZ(1215), x1: PX(1205), z1: PZ(1160), y: PLAT_Y + 12, w: 3, roof: true, parapet: false });

  // lantern staircase down to the boathouse
  const STAIR = [[1330, 1590], [1370, 1690], [1470, 1700], [1500, 1630], [1600, 1600], [1690, 1600], [1760, 1650]];
  stairPath(STAIR.map(p => [PX(p[0]), PZ(p[1])]), PLAT_Y, LAKE_Y + 2, 3, 5);

  /* ============ Boathouse ============ */
  {
    const bx = PX(1805), bz = PZ(1700);
    hall({ cx: bx, cz: bz, ang: Math.PI / 2, hl: 6, hw: 3, h: 8, y0: LAKE_Y + 3, litP: 0.8 });
    roundTower({ x: bx + 7, z: bz + 6, r: 2.5, h: 12, y0: LAKE_Y + 3 });
    // two wooden piers with lanterns reaching into the lake
    for (const px of [1795, 1840]) {
      const pz0 = PZ(1735), pz1 = PZ(1815);
      const x = PX(px);
      line2(x, pz0, x, pz1, (px2, pz2, t) => {
        set(px2 - 1, LAKE_Y + 1, pz2, PAL.WOOD2);
        set(px2, LAKE_Y + 1, pz2, PAL.WOOD2);
        set(px2 + 1, LAKE_Y + 1, pz2, PAL.WOOD2);
        if (Math.round(t * 10) % 3 === 0) {
          pierSupport(px2 - 1, pz2, LAKE_Y);
          pierSupport(px2 + 1, pz2, LAKE_Y);
        }
        if (Math.round(t * 10) % 4 === 0) lantern(px2 - 1, LAKE_Y + 2, pz2);
      });
    }
    LIGHTS.push({ x: bx, y: LAKE_Y + 6, z: bz, s: 1 });
  }
}

/* ------------------------------------------------------------
   greenhouse — 3-high glass walls, iron posts every 4,
   stepped glass roof with iron ribs, plants and one lantern
   ------------------------------------------------------------ */
function greenhouse(px0, pz0, px1, pz1) {
  const cx = PX((px0 + px1) / 2), cz = PZ((pz0 + pz1) / 2);
  const hl = Math.max(2, Math.round((px1 - px0) * S / 2));
  const hw = Math.max(2, Math.round((pz1 - pz0) * S / 2));
  const y0 = PLAT_Y, wallH = 3;
  oriented2D(cx, cz, 0, hl, hw, (u, v, x, z) => {
    dropFill(x, z, y0 - 1, PAL.STONE2, 8);
    if (Math.abs(u) === hl || Math.abs(v) === hw) {           // glass walls + iron posts
      for (let y = y0; y < y0 + wallH; y++)
        set(x, y, z, (Math.abs((u + v) % 4) === 0) ? PAL.IRON : PAL.GLASS);
    } else {                                                  // soil + plants
      set(x, y0 - 1, z, PAL.DIRT);
      if (hash(x, 1, z) < 0.65) set(x, y0, z, PAL.PLANT);
    }
  });
  // stepped glass roof with iron ribs
  const roofH = Math.max(2, hw);
  for (let k = 0; k <= roofH; k++) {
    const y = y0 + wallH + k;
    if (y >= H) break;
    const limU = Math.floor(hl * (1 - k / (roofH + 1)));
    const limV = Math.floor(hw * (1 - k / roofH));
    oriented2D(cx, cz, 0, hl, hw, (u, v, x, z) => {
      if (Math.abs(u) > limU || Math.abs(v) > limV) return;
      const rib = (Math.abs(u) % 4 === 0) || (Math.abs(v) % 4 === 0) || (k === roofH);
      set(x, y, z, rib ? PAL.IRON : PAL.GLASS);
    });
  }
  lantern(cx, y0, cz + hw + 1);                              // one lantern at the door
}

/* ------------------------------------------------------------
   cloister — covered walkway ring: pillars every 3,
   stone slab at +5, ROOF2 roof at +6
   ------------------------------------------------------------ */
function cloister(ox0, oz0, ox1, oz1, ix0, iz0, ix1, iz1) {
  const O = [PX(ox0), PZ(oz0), PX(ox1), PZ(oz1)];
  const I = [PX(ix0), PZ(iz0), PX(ix1), PZ(iz1)];
  for (let z = O[1]; z <= O[3]; z++)
    for (let x = O[0]; x <= O[2]; x++) {
      if (x >= I[0] && x <= I[2] && z >= I[1] && z <= I[3]) continue;  // inner lawn
      const s = PLAT_Y - 1;
      set(x, s, z, PAL.STONE3);
      const outer = x <= O[0] + 1 || x >= O[2] - 1 || z <= O[1] + 1 || z >= O[3] - 1;
      const inner = x <= I[0] + 1 || x >= I[2] - 1 || z <= I[1] + 1 || z >= I[3] - 1;
      if (outer || inner) {
        const along = (x <= O[0] + 1 || x >= O[2] - 1 || x <= I[0] + 1 || x >= I[2] - 1) ? z : x;
        if (Math.abs(along % 3) === 0)
          for (let y = s + 1; y <= s + 4; y++) set(x, y, z, PAL.STONE2);
      }
      set(x, s + 5, z, PAL.STONE3);                            // slab
      set(x, s + 6, z, PAL.ROOF2);                             // roof
    }
}