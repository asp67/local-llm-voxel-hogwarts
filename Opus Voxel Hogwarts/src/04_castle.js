
// ============================================================================
// 7. HOGWARTS CASTLE — laid out from the reference plan (plan pixels -> voxels)
// ============================================================================
const PY = PLAT_Y - 1;   // plateau top voxel
const deg = a => a * Math.PI / 180;

function hallRect(px0, py0, px1, py1, alongZ, o) {
  const x0 = PX(px0), x1 = PX(px1), z0 = PZ(py0), z1 = PZ(py1);
  const cx = Math.floor((x0 + x1) / 2), cz = Math.floor((z0 + z1) / 2);
  const hx = Math.floor((x1 - x0) / 2), hz = Math.floor((z1 - z0) / 2);
  return alongZ ? hall({ ...o, cx, cz, ang: Math.PI / 2, hl: hz, hw: hx }) : hall({ ...o, cx, cz, ang: 0, hl: hx, hw: hz });
}
function towerAt(px, py, pr, o) { return roundTower({ x: PX(px), z: PZ(py), r: Math.max(1.5, pr * S), ...o }); }
function pave(px0, py0, px1, py1, a = STONE3, b = PATH, y = PY) {
  for (let z = PZ(py0); z <= PZ(py1); z++) for (let x = PX(px0); x <= PX(px1); x++)
    if (isSolid(get(x, y, z)) && !isSolid(get(x, y + 1, z))) set(x, y, z, mod(x + z, 2) ? a : b);
}
function lawn(px0, py0, px1, py1, y = PY) {
  for (let z = PZ(py0); z <= PZ(py1); z++) for (let x = PX(px0); x <= PX(px1); x++)
    if (isSolid(get(x, y, z)) && !isSolid(get(x, y + 1, z))) set(x, y, z, hash(x, 3, z) < 0.5 ? GRASS : GRASS2);
}
function fountain(x, z, y = PY + 1, r = 3) {
  cyl(x, z, r, y, y, STONE3); cyl(x, z, r - 1, y, y, WATER);
  box(x, y, z, x, y + 3, z, STONE3); set(x, y + 4, z, WATER);
  LIGHTS.warm.push([x, y + 6, z, 0.6]);
}
function lampPost(x, z, y) { set(x, y, z, IRON); set(x, y + 1, z, IRON); set(x, y + 2, z, LANT); }
function clockFace(x, yc, z, axis, dir) { // axis 'x' face normal along x
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
    const d2 = a * a + b * b; if (d2 > 10) continue;
    const m = d2 > 6 ? GOLD : ((a === 0 && b >= 0 && b <= 2) || (b === 0 && a >= 0 && a <= 1)) ? BLACK : CLOCK;
    if (axis === 'x') set(x + dir, yc + b, z + a, m); else set(x + a, yc + b, z + dir, m);
  }
}
function rampart(pts, h = 6) { // crenellated wall following terrain, pts in plan px
  for (let i = 1; i < pts.length; i++) {
    const x0 = PX(pts[i - 1][0]), z0 = PZ(pts[i - 1][1]), x1 = PX(pts[i][0]), z1 = PZ(pts[i][1]);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ang = Math.atan2(z1 - z0, x1 - x0), hl = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2);
    oriented2D(cx, cz, ang, hl, 1, (x, z, u, v) => {
      const t = topY[TI(x, z)]; if (t < 0) return;
      for (let y = t + 1; y <= t + h; y++) set(x, y, z, y === t + h ? STONE3 : (y < t + 3 ? STONE2 : STONE));
      if (Math.abs(v) === 1 && mod(u, 2) === 0) set(x, t + h + 1, z, STONE3);
    });
  }
}

function greenhouse(x0, z0, x1, z1) {
  const alongZ = (z1 - z0) > (x1 - x0);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const edge = x === x0 || x === x1 || z === z0 || z === z1;
    const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
    if (!edge) { if (hash(x, 1, z) < 0.7) set(x, PLAT_Y, z, PLANT); if (hash(x, 2, z) < 0.3) set(x, PLAT_Y + 1, z, PLANT); continue; }
    const post = corner || (alongZ ? mod(z - z0, 4) === 0 : mod(x - x0, 4) === 0);
    for (let y = PLAT_Y; y < PLAT_Y + 3; y++) set(x, y, z, post ? IRON : (y === PLAT_Y ? STONE3 : GLASS));
  }
  const half = alongZ ? (x1 - x0) / 2 : (z1 - z0) / 2;
  for (let k = 0; k <= Math.ceil(half); k++) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const across = alongZ ? Math.min(x - x0, x1 - x) : Math.min(z - z0, z1 - z);
      if (across !== k) continue;
      const along = alongZ ? z - z0 : x - x0;
      set(x, PLAT_Y + 3 + k, z, (across >= half - 0.5 || mod(along, 4) === 0) ? IRON : GLASS);
    }
  }
  LIGHTS.small.push([(x0 + x1) >> 1, PLAT_Y + 2, (z0 + z1) >> 1]);
  set((x0 + x1) >> 1, PLAT_Y + 1, (z0 + z1) >> 1, LANT);
}

function buildCastle() {
  // ---------------- Greenhouse compound (north-east) ----------------
  lawn(1120, 450, 1580, 1020);
  for (const [a, b, c, d] of [[1320, 470, 1380, 575], [1130, 505, 1560, 525], [1430, 575, 1465, 1015], [1130, 560, 1420, 575]])
    pave(a, b, c, d, GRAVEL, PATH);
  for (let x = PX(1120); x <= PX(1585); x++) { set(x, PLAT_Y, PZ(440), STONE2); set(x, PLAT_Y + 1, PZ(440), mod(x, 2) ? STONE3 : 0); }
  for (let z = PZ(440); z <= PZ(1025); z++) { set(PX(1585), PLAT_Y, z, STONE2); set(PX(1585), PLAT_Y + 1, z, mod(z, 2) ? STONE3 : 0); }
  for (const [a, b, c, d] of [[1130, 470, 1300, 505], [1130, 530, 1300, 560], [1395, 470, 1560, 505], [1395, 530, 1560, 560],
    [1470, 580, 1510, 730], [1525, 580, 1565, 730], [1470, 745, 1510, 890], [1525, 745, 1565, 890]])
    greenhouse(PX(a), PZ(b), PX(c), PZ(d));
  { // octagonal glass pavilion
    const x = PX(1350), z = PZ(448);
    cyl(x, z, 3.2, PLAT_Y, PLAT_Y, STONE3); cyl(x, z, 3.2, PLAT_Y + 1, PLAT_Y + 3, GLASS); cyl(x, z, 2.2, PLAT_Y + 1, PLAT_Y + 2, PLANT);
    for (let k = 0; k < 4; k++) disk(x, z, 3.2 - k * 0.9, PLAT_Y + 4 + k, k === 0 ? IRON : GLASS);
    set(x, PLAT_Y + 8, z, GOLD); set(x, PLAT_Y + 1, z, LANT);
  }

  // ---------------- North quadrangle ----------------
  hallRect(960, 605, 1275, 680, false, { h: 24, dormers: true, litP: 0.45 });                 // north range
  hallRect(960, 605, 1030, 915, true, { h: 24, dormers: true, litP: 0.45 });                  // west range
  { // cloister around the grass courtyard
    lawn(1060, 700, 1240, 880);
    const x0 = PX(1032), x1 = PX(1270), z0 = PZ(682), z1 = PZ(910), xi0 = PX(1058), xi1 = PX(1242), zi0 = PZ(698), zi1 = PZ(882);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (x > xi0 && x < xi1 && z > zi0 && z < zi1) continue;
      set(x, PY, z, mod(x + z, 2) ? STONE3 : PATH);
      const onV = x === xi0 || x === xi1, onH = z === zi0 || z === zi1;
      if ((onV && mod(z, 3) === 0) || (onH && mod(x, 3) === 0)) box(x, PLAT_Y, z, x, PLAT_Y + 4, z, STONE3);
      set(x, PLAT_Y + 5, z, STONE3); set(x, PLAT_Y + 6, z, ROOF2);
    }
    fountain(PX(1150), PZ(790), PLAT_Y, 3);
    for (const [a, b] of [[1100, 740], [1200, 740], [1100, 840], [1200, 840]]) lampPost(PX(a), PZ(b), PLAT_Y);
    LIGHTS.warm.push([PX(1150), PLAT_Y + 10, PZ(790), 1]);
  }

  // ---------------- Spine, twin gothic towers, south wing ----------------
  hallRect(1275, 590, 1425, 910, true, { h: 26, dormers: true, litP: 0.5, roofH: 11, buttress: 4 });
  hallRect(1310, 905, 1390, 1150, true, { h: 22, dormers: true, litP: 0.5 });
  squareTower({ x: PX(1280), z: PZ(612), s: 4, h: 40, roofH: 24, pinnacles: true, win: 'gothic', ev: 2, litP: 0.6, pinH: 9 });
  squareTower({ x: PX(1410), z: PZ(612), s: 4, h: 40, roofH: 24, pinnacles: true, win: 'gothic', ev: 2, litP: 0.6, pinH: 9 });
  squareTower({ x: PX(1345), z: PZ(598), s: 3, h: 36, roofH: 34, pinnacles: true, win: 'gothic', ev: 2, litP: 0.7 });
  hallRect(1220, 910, 1500, 1030, false, { h: 24, dormers: true, litP: 0.5 });                // south cross wing
  squareTower({ x: PX(1350), z: PZ(958), s: 6, h: 34, roofH: 16, pinnacles: true, litP: 0.55 });
  hallRect(1225, 1055, 1500, 1145, false, { h: 22, dormers: true, litP: 0.45, buttress: 3 }); // south block
  towerAt(1215, 1062, 30, { h: 30 }); towerAt(1480, 1062, 30, { h: 30 });
  towerAt(1215, 1142, 36, { h: 26, crenel: true, cone: false }); towerAt(1480, 1142, 36, { h: 26 });
  pave(1095, 905, 1220, 1025); fountain(PX(1150), PZ(955), PLAT_Y, 3);

  // ---------------- West blocks, apse tower, bridge to the grounds ----------------
  hallRect(1000, 915, 1075, 1030, true, { h: 24, litP: 0.5 });
  hallRect(890, 960, 1000, 1030, true, { h: 20, litP: 0.5 });
  towerAt(945, 1035, 55, { h: 20, coneH: 13, litP: 0.6 });
  towerAt(897, 960, 14, { h: 27 }); towerAt(1000, 953, 14, { h: 29 }); towerAt(945, 920, 18, { h: 31 });
  bridge({ x0: PX(885), z0: PZ(990), x1: PX(575), z1: PZ(968), y: PY, w: 1, lanterns: 5, pierEvery: 7 });
  roundTower({ x: PX(560), z: PZ(966), r: 3, h: 10, coneH: 9 });

  // ---------------- North-west angled wing + the grounds ramparts ----------------
  hall({ cx: PX(830), cz: PZ(605), ang: deg(-22), hl: 11, hw: 7, h: 28, dormers: true, roofH: 10, litP: 0.5, buttress: 3 });
  hall({ cx: PX(890), cz: PZ(700), ang: deg(19), hl: 12, hw: 3, h: 20, litP: 0.5 });
  towerAt(848, 745, 26, { h: 26 }); towerAt(922, 770, 26, { h: 24 });
  squareTower({ x: PX(735), z: PZ(575), s: 3, h: 36, roofH: 22, ang: deg(-22), pinnacles: true, litP: 0.5 });
  hall({ cx: PX(1100), cz: PZ(420), ang: deg(-25), hl: 7, hw: 4, h: 14, litP: 0.5 });
  towerAt(1155, 405, 22, { h: 20 });
  hallRect(1080, 465, 1122, 605, true, { h: 12, litP: 0.4 });
  rampart([[1090, 380], [990, 190], [945, 165], [885, 140], [670, 150], [535, 345], [505, 405]], 6);
  for (const [a, b] of [[990, 190], [885, 140], [670, 150], [535, 345]]) {
    const x = PX(a), z = PZ(b), t = topY[TI(x, z)] + 1; roundTower({ x, z, r: 2.6, y0: t, h: 12, coneH: 9, litP: 0.3 });
  }
  { // the Owlery
    const x = PX(505), z = PZ(405), t = topY[TI(x, z)] + 1;
    roundTower({ x, z, r: 4.5, y0: t, h: 30, coneH: 14, litP: 0.15, winN: 10 });
  }

  // ---------------- Courtyard block with clock tower & astronomy tower ----------------
  hallRect(780, 1180, 1060, 1265, false, { h: 26, dormers: true, buttress: 3, litP: 0.5 });
  hallRect(780, 1180, 860, 1500, true, { h: 26, dormers: true, litP: 0.5 });
  hallRect(780, 1420, 1040, 1500, false, { h: 24, dormers: true, litP: 0.5, arches: true });
  hallRect(1040, 1235, 1120, 1420, true, { h: 26, dormers: true, litP: 0.5 });
  pave(862, 1267, 1038, 1418); fountain(PX(950), PZ(1340), PLAT_Y, 3);
  for (const [a, b] of [[880, 1290], [1020, 1290], [880, 1400], [1020, 1400]]) lampPost(PX(a), PZ(b), PLAT_Y);
  towerAt(775, 1182, 42, { h: 32 }); towerAt(775, 1495, 42, { h: 30 }); towerAt(1105, 1235, 45, { h: 34 });
  towerAt(1000, 1168, 14, { h: 31 }); towerAt(1065, 1168, 14, { h: 33 }); towerAt(1060, 1545, 14, { h: 22 });
  { // clock tower on the west range
    const x = PX(795), z = PZ(1340);
    squareTower({ x, z, s: 5, h: 44, roofH: 18, pinnacles: true, litP: 0.55 });
    clockFace(x - 5, PLAT_Y + 36, z, 'x', -1); clockFace(x + 5, PLAT_Y + 36, z, 'x', 1);
  }
  { // Astronomy Tower — tallest in the castle
    const x = PX(1100), z = PZ(1490);
    roundTower({ x, z, r: 10, h: 44, crenel: true, machi: true, coneH: 42, spire: 5, litP: 0.5, winN: 12 });
    roundTower({ x: x - 7, z: z - 5, r: 2.2, y0: PLAT_Y + 40, h: 14, coneH: 10, found: false });
    roundTower({ x: x - 4, z: z - 8, r: 1.6, y0: PLAT_Y + 44, h: 14, coneH: 8, found: false });
    LIGHTS.warm.push([x, PLAT_Y + 48, z + 13, 0.8]);
  }

  // ---------------- Clock-tower courtyard (west) + wooden bridge ----------------
  hallRect(595, 1255, 700, 1420, true, { h: 22, dormers: true, litP: 0.5 });
  hallRect(420, 1255, 595, 1278, false, { h: 10, roof: 'flat', crenel: true, win: 'none' });
  hallRect(420, 1398, 595, 1420, false, { h: 10, roof: 'flat', crenel: true, win: 'none' });
  hallRect(420, 1255, 455, 1420, true, { h: 12, roof: 'flat', crenel: true, win: 'none' });
  towerAt(425, 1262, 16, { h: 15 }); towerAt(425, 1412, 16, { h: 15 });
  pave(456, 1279, 594, 1397); fountain(PX(525), PZ(1338), PLAT_Y, 3);
  for (let y = PLAT_Y; y < PLAT_Y + 5; y++) for (let z = PZ(1328); z <= PZ(1352); z++) setAir(PX(430), y, z), setAir(PX(440), y, z), setAir(PX(450), y, z);
  bridge({ x0: PX(700), z0: PZ(1340), x1: PX(782), z1: PZ(1340), y: PY, w: 2, roof: true, pierEvery: 5 });
  bridge({ x0: PX(422), z0: PZ(1340), x1: PX(240), z1: PZ(1340), y: PY, w: 2, kind: 'wood', roof: true, truss: true, pierEvery: 4 });
  roundTower({ x: PX(232), z: PZ(1340), r: 2.5, h: 8, coneH: 8 });

  // ---------------- Great Hall ----------------
  {
    const cx = PX(GH.px), cz = PZ(GH.py), a = deg(GH.ang);
    // terrace around the hall
    oriented2D(cx, cz, a, 26, 8, (x, z) => { if (isSolid(get(x, PY, z))) set(x, PY, z, mod(x + z, 2) ? STONE3 : PATH); dropFill(x, PY, z, STONE2); });
    hall({ cx, cz, ang: a, hl: 24, hw: 5, h: 28, roofH: 10, win: 'gothic', ev: 3, buttress: 3, litP: 0.95, bright: WIN2 });
    const [tx, tz] = toWorld(cx, cz, a, 8, 8);
    roundTower({ x: tx, z: tz, r: 3, h: 34, coneH: 12, litP: 0.6 });
    const [fx, fz] = toWorld(cx, cz, a, 0, 0);                           // flèche on the ridge
    box(fx, PLAT_Y + 39, fz, fx, PLAT_Y + 41, fz, STONE3); for (let i = 0; i < 7; i++) set(fx, PLAT_Y + 42 + i, fz, i > 4 ? COPPER : ROOF);
    for (const u of [-24, 24]) { const [ex, ez] = toWorld(cx, cz, a, u, 0); for (const dv of [-6, 6]) {
      const [px2, pz2] = toWorld(cx, cz, a, u, dv); box(px2, PLAT_Y, pz2, px2, PLAT_Y + 31, pz2, STONE3);
      for (let i = 0; i < 6; i++) set(px2, PLAT_Y + 32 + i, pz2, i === 5 ? COPPER : ROOF); } }
    for (const v of [-9, 9]) for (let u = -22; u <= 22; u += 3) { const [lx, lz] = toWorld(cx, cz, a, u, v); LIGHTS.small.push([lx, PLAT_Y + 8, lz]); }
    LIGHTS.warm.push([cx, PLAT_Y + 14, cz + 12, 1.6], [cx - 8, PLAT_Y + 14, cz - 8, 1.2]);
  }

  // ---------------- Bridges & stairs ----------------
  bridge({ x0: PX(1340), z0: PZ(1170), x1: PX(1250), z1: PZ(1465), y: PY, w: 1, lanterns: 6, pierEvery: 5 });
  bridge({ x0: PX(1145), z0: PZ(1215), x1: PX(1205), z1: PZ(1160), y: PY + 12, w: 1, roof: true, pierEvery: 99 });
  stairPath([[1330, 1590], [1370, 1690], [1470, 1700], [1500, 1630], [1600, 1600], [1690, 1600], [1760, 1650]]
    .map(([a, b]) => [PX(a), PZ(b)]), PY, LAKE_Y + 2, 1, 5);

  // ---------------- Boathouse ----------------
  {
    const x = PX(1805), z = PZ(1700), y0 = LAKE_Y + 3;
    hall({ cx: x, cz: z, ang: Math.PI / 2, hl: 6, hw: 3, y0, h: 8, roofH: 5, dormers: true, litP: 0.9 });
    roundTower({ x: x + 4, z: z - 6, r: 2, y0, h: 12, coneH: 8, litP: 0.8 });
    for (let k = 0; k < 12; k++) for (const dx of [-3, 3]) { set(x + dx, LAKE_Y + 1, z + 7 + k, WOOD2); if (k % 4 === 3) { set(x + dx, LAKE_Y + 2, z + 7 + k, IRON); set(x + dx, LAKE_Y + 3, z + 7 + k, LANT); } }
    LIGHTS.warm.push([x, y0 + 6, z + 10, 1]);
  }

  // torches around courtyards & gates
  LIGHTS.warm.push([PX(950), PLAT_Y + 8, PZ(1340), 0.9], [PX(525), PLAT_Y + 8, PZ(1338), 0.8], [PX(1150), PLAT_Y + 8, PZ(955), 0.8],
    [PX(1350), PLAT_Y + 6, PZ(700), 0.6]);
}
