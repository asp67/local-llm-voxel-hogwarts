/* ════════════════════════════════════════════════════════════════════
   04_castle.js — the Hogwarts layout, every building from the plan
   Plan-pixel coordinates are converted inside via PX()/PZ(); heights in voxels.
   ════════════════════════════════════════════════════════════════════ */

const addLight = (x, y, z, s = 1) => POINTS.push({ x, y, z, s });

/* gravel/path stroke across terrain tops */
function pathLine(xa, za, xb, zb, m = GRAVEL) {
  const n = Math.max(1, Math.round(Math.hypot(xb - xa, zb - za)));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(lerp(xa, xb, i / n)), z = Math.round(lerp(za, zb, i / n));
    const t = surfY(x, z);
    if (t > LAKE_Y + 1 && KIND[get(x, t, z)] === 1 && KIND[get(x, t, z)] !== KIND.WINDK)
      set(x, t, z, m);
  }
}

/* crenellated wall following the terrain along plan-px vertices */
function crenelWall(pts, h, turret = 0) {
  const P = pts.map(p => [PF(p[0]), QZ(p[1])]);
  for (let s = 0; s < P.length - 1; s++) {
    const xa = P[s][0], za = P[s][1], xb = P[s + 1][0], zb = P[s + 1][1];
    const n = Math.max(1, Math.round(Math.hypot(xb - xa, zb - za)));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(lerp(xa, xb, i / n)), z = Math.round(lerp(za, zb, i / n));
      const t = surfY(x, z);
      if (t <= LAKE_Y) continue;
      for (let k = 1; k <= h; k++) set(x, t + k, z, k < 3 ? STONE2 : STONE);
      if (((x + z) & 1) === 0) set(x, t + h + 1, z, STONE3);
    }
  }
  if (turret) for (const [px, pz] of pts) {
    const x = PX(px), z = PZ(pz), t = surfY(x, z);
    if (t > LAKE_Y) roundTower({ x, z, r: turret, y0: t + 1, h: 12, crenel: true, litP: 0.2 });
  }
}

/* paved rectangle / oriented terrace over the terrain top */
function paveRect(px0, pz0, px1, pz1) {
  for (let z = PZ(pz0); z <= PZ(pz1); z++) for (let x = PX(px0); x <= PX(px1); x++) {
    const t = surfY(x, z);
    if (t > LAKE_Y + 1 && KIND[get(x, t, z)] < 3) set(x, t, z, hash(x, 0, z, 43) < 0.62 ? STONE3 : PATH);
  }
}
function paveRing(cx, cz, ang, hl, hw) {   /* 2-voxel terrace around a hall */
  oriented2D(cx, cz, ang, hl + 1, hw + 1, (u, v, x, z) => {
    if (Math.abs(u) <= hl && Math.abs(v) <= hw) return;
    const t = surfY(x, z);
    if (t > PLAT_Y - 30) set(x, t, z, hash(x, 0, z, 43) < 0.62 ? STONE3 : PATH);
  });
}

/* glass greenhouse from a plan-px rect: 3-high glazed walls, stepped glass roof */
function greenhouse(px0, pz0, px1, pz1) {
  const x0 = PX(px0), z0 = PZ(pz0), x1 = PX(px1), z1 = PZ(pz1);
  const ys = PLAT_Y;
  const spanX = x1 - x0, spanZ = z1 - z0;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const ed = x === x0 || x === x1 || z === z0 || z === z1;
    if (ed) {
      for (let y = ys; y < ys + 3; y++) set(x, y, z, ((x + z) % 4 === 0) ? IRON : GLASS);
      for (let y = ys - 1; y > ys - 40; y--) { if (get(x, y, z)) break; set(x, y, z, STONE2); }
    } else if ((x + z) % 6 === 0) set(x, ys, z, PLANT);
    /* stepped glass roof, ridge across the SHORT axis */
    const level = spanX >= spanZ ? Math.min(z - z0, z1 - z) : Math.min(x - x0, x1 - x);
    const ry = ys + 3 + (level >= 1 ? 1 : 0);
    set(x, ry, z, ed ? (((x + z) % 4 === 1) ? IRON : ROOF2)
                     : (((x + z) % 4 === 0) ? IRON : GLASS));
    /* second ridge step on wide houses */
    if (level >= 2) set(x, ry + 1, z, ((x % 4 === 2) ? IRON : GLASS));
  }
  set(x0 + 1, ys + 2, z0 + 1, LANT);
}

function pavilion(x, z) {
  const y0 = PLAT_Y;
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
    const mx = Math.max(Math.abs(dx), Math.abs(dz)), sm = Math.abs(dx) + Math.abs(dz);
    if (mx <= 3 && sm <= 5) {
      if (mx === 3 || sm === 5) {
        for (let y = y0; y < y0 + 4; y++) set(x + dx, y, z + dz, ((dx + dz) % 3 === 0) ? IRON : GLASS);
        for (let y = y0 - 1; y > y0 - 30; y--) { if (get(x + dx, y, z + dz)) break; set(x + dx, y, z + dz, STONE2); }
      }
    } else if (mx <= 4 && sm <= 7) {
      set(x + dx, y0 + 4, z + dz, GLASS);                    /* eave ring */
    }
  }
  for (let k = 0; k < 4; k++) {
    const r4 = 3.4 - k * 0.9;
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++)
      if (Math.hypot(dx, dz) <= r4) set(x + dx, y0 + 5 + k, z + dz, GLASS);
  }
  set(x, y0 + 9, z, GOLD); set(x, y0 + 10, z, LANT);
}

function cloister() {
  /* ring corridor (1032,682)-(1270,910) around lawn (1060,700)-(1240,880) */
  const X0 = PX(1032), X1 = PX(1270), Z0 = PZ(682), Z1 = PZ(910);
  const LX0 = PX(1060), LX1 = PX(1240), LZ0 = PZ(700), LZ1 = PZ(880);
  for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) {
    const inner = x > LX0 && x < LX1 && z > LZ0 && z < LZ1;
    if (inner) {                                     /* lawn keeps grass */
      if ((x + z) % 37 === 0) set(x, 99, z, MOSS);
      continue;
    }
    set(x, 99, z, hash(x, 0, z, 43) < 0.7 ? STONE3 : PATH);          /* paving */
    if ((x === LX0 || x === LX1 || z === LZ0 || z === LZ1) &&
        ((z === LZ0 || z === LZ1) ? x % 3 === 1 : z % 3 === 1)) {      /* pillars */
      for (let y = 100; y <= 104; y++) set(x, y, z, y === 104 ? STONE2 : STONE3);
    }
    set(x, 105, z, (x === X0 || x === X1 || z === Z0 || z === Z1) ? ROOF2 : ROOF2);
  }
}

/* covered stone gallery across terrain (used for short passages) */
function stonePassage(px0, pz0, px1, pz1) {
  bridge({ x0: PX(px0), z0: PZ(pz0), x1: PX(px1), z1: PZ(pz1), y: PLAT_Y, w: 3, cover: true });
}

function clockFace(x, yMid, zMid, xSign) {
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) {
    const rim = Math.abs(dz) === 1 || Math.abs(dy) === 1;
    set(x + xSign * 1, yMid + dy, zMid + dz, rim ? GOLD : CLOCK);
  }
  set(x + xSign * 1, yMid, zMid + 1, BLACK);      /* hour hand   */
  set(x + xSign * 1, yMid + 1, zMid, BLACK);      /* minute hand */
}

function buildCastle() {
  const yP = PLAT_Y - 1;                          /* plateau top voxel */

  /* ── Greenhouse compound (NE) ── */
  pathLine(PX(1122), PZ(517), PX(1568), PZ(517));           /* between rows */
  pathLine(PX(1122), PZ(917), PX(1568), PZ(917));
  pathLine(PX(1347), PZ(438), PX(1347), PZ(1015));          /* between the two groups */
  pathLine(PX(1125), PZ(445), PX(1575), PZ(445));           /* perimeter ring */
  pathLine(PX(1126), PZ(1012), PX(1575), PZ(1012));
  pathLine(PX(1128), PZ(447), PX(1128), PZ(1013));
  greenhouse(1130, 470, 1300, 505); greenhouse(1130, 530, 1300, 560);
  greenhouse(1395, 470, 1560, 505); greenhouse(1395, 530, 1560, 560);
  greenhouse(1470, 580, 1510, 730); greenhouse(1525, 580, 1565, 730);
  greenhouse(1470, 745, 1510, 890); greenhouse(1525, 745, 1565, 890);
  pavilion(PX(1350), PZ(448));
  crenelWall([[1120, 448], [1585, 448]], 4);
  crenelWall([[1581, 452], [1581, 1018]], 4);

  /* ── North quadrangle ── */
  hall({ cx: PX(1117.5), cz: PZ(642.5), hl: 18.9, hw: 4.5, h: 24, roofH: 6, dormers: true });
  hall({ cx: PX(995), cz: PZ(760), ang: 90, hl: 18.6, hw: 4.2, h: 24, roofH: 5 });
  cloister();
  fountain(PX(1150), PZ(790), yP);
  lampPost(PX(1062), PZ(706), yP); lampPost(PX(1238), PZ(706), yP);
  lampPost(PX(1062), PZ(874), yP); lampPost(PX(1238), PZ(874), yP);
  addLight(PX(1150), yP + 5, PZ(790));

  /* ── Spine & gothic towers ── */
  hall({ cx: PX(1350), cz: PZ(750), ang: 90, hl: 19.2, hw: 9, h: 26, roofH: 11,
         buttress: 4, dormers: true });
  hall({ cx: PX(1350), cz: PZ(1027.5), ang: 90, hl: 14.5, hw: 5, h: 22, roofH: 6 });   /* nave continues S from the spine */
  squareTower({ cx: PX(1280), cz: PZ(612), s: 4, h: 40, roofH: 24, win: 'gothic', pinn: 9, floorH: 9 });
  squareTower({ cx: PX(1410), cz: PZ(612), s: 4, h: 40, roofH: 24, win: 'gothic', pinn: 9, floorH: 9 });
  squareTower({ cx: PX(1345), cz: PZ(598), s: 3, h: 36, roofH: 34, win: 'gothic', floorH: 9 });
  hall({ cx: PX(1360), cz: PZ(970), hl: 16.8, hw: 7.2, h: 24, roofH: 7, dormers: true });
  squareTower({ cx: PX(1350), cz: PZ(958), s: 6, h: 34, roofH: 16, pinn: 9 });
  hall({ cx: PX(1362.5), cz: PZ(1100), hl: 16.5, hw: 5.4, h: 22, buttress: 3, roofH: 6 });
  roundTower({ x: PX(1215), z: PZ(1062), r: 3.6, h: 30, cone: 13 });
  roundTower({ x: PX(1480), z: PZ(1062), r: 3.6, h: 30, cone: 13 });
  roundTower({ x: PX(1215), z: PZ(1142), r: 4.3, h: 26, crenel: true });
  roundTower({ x: PX(1480), z: PZ(1142), r: 4.3, h: 26, crenel: true });

  /* fountain plaza */
  paveRect(1095, 905, 1220, 1025);
  fountain(PX(1157.5), PZ(965), yP);
  lampPost(PX(1108), PZ(917), yP); lampPost(PX(1208), PZ(917), yP);
  lampPost(PX(1108), PZ(1013), yP); lampPost(PX(1208), PZ(1013), yP);
  addLight(PX(1157.5), yP + 5, PZ(965), 1.1);

  /* ── West blocks ── */
  hall({ cx: PX(1037.5), cz: PZ(972.5), ang: 90, hl: 6.9, hw: 4.5, h: 24, roofH: 6 });
  hall({ cx: PX(945), cz: PZ(995), ang: 90, hl: 6.6, hw: 4.2, h: 20, roofH: 5 });
  roundTower({ x: PX(945), z: PZ(1035), r: 6.6, h: 20, cone: 13, litP: 0.4 });
  roundTower({ x: PX(897), z: PZ(960), r: 2.6, h: 27, cone: 10, litP: 0.3 });
  roundTower({ x: PX(1000), z: PZ(953), r: 2.6, h: 29, cone: 10, litP: 0.3 });
  roundTower({ x: PX(945), z: PZ(920), r: 2.8, h: 31, cone: 11, litP: 0.35 });
  /* west stone bridge + gatehouse */
  bridge({ x0: PX(885), z0: PZ(990), x1: PX(575), z1: PZ(968), y: PLAT_Y, pierEvery: 5, lantEvery: 5 });
  roundTower({ x: PX(560), z: PZ(966), r: 3, h: 10, crenel: true, machi: true, litP: 0.5 });
  addLight(PX(560), yP + 6, PZ(966), 0.8);

  /* ── NW angled wing & grounds ── */
  hall({ cx: PX(830), cz: PZ(605), ang: -22, hl: 11, hw: 7, h: 28, roofH: 9, dormers: true, buttress: 3 });
  hall({ cx: PX(890), cz: PZ(700), ang: 19, hl: 12, hw: 3, h: 20, roofH: 5 });
  roundTower({ x: PX(848), z: PZ(745), r: 2.8, h: 26, cone: 11, litP: 0.4 });
  roundTower({ x: PX(922), z: PZ(770), r: 2.6, h: 24, cone: 10, litP: 0.4 });
  squareTower({ cx: PX(735), cz: PZ(575), ang: -22, s: 3, h: 36, roofH: 22, win: 'gothic', floorH: 9 });
  hall({ cx: PX(1100), cz: PZ(420), ang: -25, hl: 7, hw: 4, h: 14, roofH: 4, arches: true });
  roundTower({ x: PX(1155), z: PZ(405), r: 2.4, h: 20, cone: 9, litP: 0.25 });
  /* covered passage h12 from the connector to the spine (1080,465)-(1122,605) */
  hall({ cx: PF(1101), cz: QZ(535), ang: 90, hl: 8.4, hw: 2.5, h: 12, roofH: 3, arches: true, win: 'none' });
  /* rampart + owlery */
  crenelWall([[1090, 380], [990, 190], [945, 165], [885, 140], [670, 150], [535, 345], [505, 405]], 6, 2.6);
  roundTower({ x: PX(505), z: PZ(405), r: 4.5, h: 30, cone: 14, dark: true, winN: 11 });

  /* ── Courtyard block, Clock Tower & Astronomy Tower ── */
  hall({ cx: PX(920), cz: PZ(1222.5), hl: 16.8, hw: 5.1, h: 26, buttress: 3, roofH: 7 });
  hall({ cx: PX(820), cz: PZ(1340), ang: 90, hl: 19.2, hw: 4.8, h: 26, roofH: 6 });
  hall({ cx: PX(910), cz: PZ(1460), hl: 15.6, hw: 4.8, h: 24, arches: true, roofH: 5 });
  hall({ cx: PX(1080), cz: PZ(1327.5), ang: 90, hl: 11.1, hw: 4.8, h: 26, roofH: 6 });
  paveRect(866, 1268, 1034, 1416);
  fountain(PX(950), PZ(1340), yP);
  lampPost(PX(872), PZ(1274), yP); lampPost(PX(1030), PZ(1274), yP);
  lampPost(PX(872), PZ(1410), yP); lampPost(PX(1030), PZ(1410), yP);
  addLight(PX(950), yP + 5, PZ(1340), 1.1);
  roundTower({ x: PX(775), z: PZ(1182), r: 5, h: 32, cone: 14, litP: 0.5 });
  roundTower({ x: PX(775), z: PZ(1495), r: 5, h: 30, cone: 13, litP: 0.5 });
  roundTower({ x: PX(1105), z: PZ(1235), r: 5.4, h: 34, cone: 15, litP: 0.5 });
  roundTower({ x: PX(1000), z: PZ(1168), r: 2.4, h: 18, cone: 8 });
  roundTower({ x: PX(1065), z: PZ(1168), r: 2.4, h: 18, cone: 8 });
  roundTower({ x: PX(1060), z: PZ(1545), r: 2.6, h: 20, cone: 9 });
  /* Clock Tower */
  squareTower({ cx: PX(795), cz: PZ(1340), s: 5, h: 44, roofH: 18, pinn: 9, floorH: 9 });
  clockFace(PX(795), PLAT_Y + 36, PZ(1340), -1);
  clockFace(PX(795), PLAT_Y + 36, PZ(1340), +1);
  addLight(PX(795), PLAT_Y + 40, PZ(1340), 0.7);
  /* Astronomy Tower — tallest point ≈ y 192 */
  roundTower({ x: PX(1100), z: PZ(1490), r: 10, h: 44, cone: 42, spire: 5, crenel: true, machi: true, litP: 0.35 });
  roundTower({ x: PX(1100) - 7, z: PZ(1490) - 5, r: 2, y0: PLAT_Y + 62, h: 14, cone: 6, litP: 0.3 });
  roundTower({ x: PX(1100) - 4, z: PZ(1490) - 8, r: 1.8, y0: PLAT_Y + 66, h: 11, cone: 5, litP: 0.3 });
  addLight(PX(1100), PLAT_Y + 50, PZ(1490), 1.3);

  /* ── Clock-tower courtyard (W) & covered wooden bridge ── */
  hall({ cx: PX(647.5), cz: PZ(1337.5), ang: 90, hl: 9.9, hw: 6.3, h: 22, roofH: 6, dormers: true });
  crenelWall([[425, 1262], [700, 1258]], 10);
  crenelWall([[425, 1412], [700, 1416]], 10);
  crenelWall([[425, 1262], [425, 1412]], 12);
  roundTower({ x: PX(425), z: PZ(1262), r: 2.6, h: 14, cone: 8, litP: 0.25 });
  roundTower({ x: PX(425), z: PZ(1412), r: 2.6, h: 14, cone: 8, litP: 0.25 });
  paveRect(430, 1268, 692, 1408);
  fountain(PX(525), PZ(1338), yP);
  addLight(PX(525), yP + 5, PZ(1338), 0.9);
  /* gate arch through the west curtain */
  for (let z = PZ(1332); z <= PZ(1348); z++)
    for (let y = PLAT_Y; y <= PLAT_Y + 8; y++) set(PX(425), y, z, 0);
  for (let z = PZ(1332); z <= PZ(1348); z++) set(PX(425), PLAT_Y + 9, z, STONE2);
  stonePassage(700, 1340, 782, 1340);
  bridge({ x0: PX(422), z0: PZ(1340), x1: PX(232), z1: PZ(1340), y: PLAT_Y, wood: true, truss: true, cover: true });
  roundTower({ x: PX(232), z: PZ(1340), r: 3, h: 10, crenel: true, litP: 0.45 });
  addLight(PX(422), yP + 4, PZ(1340), 0.7);
  /* paths from the bridge westwards */
  pathLine(PX(232), PZ(1340), PX(150), PZ(1500), GRAVEL);

  /* ── Great Hall ── */
  const GHX = PX(1125), GHZ = PZ(1655);
  paveRing(GHX, GHZ, -34.9, 24, 5);
  hall({ cx: GHX, cz: GHZ, ang: -34.9, hl: 24, hw: 5, h: 28, roofH: 10,
         win: 'gothic', winMat: WIN2, litP: 0.9, buttress: 3, floorH: 9, gableWin: true });
  {
    const [stx, stz] = toWorld2(GHX, GHZ, -34.9, 8, 7);
    roundTower({ x: stx, z: stz, r: 3, h: 34, cone: 11, litP: 0.5 });
  }
  {
    /* copper flèche midway on the ridge */
    const [fx, fz] = toWorld2(GHX, GHZ, -34.9, 0, 0);
    const ry = PLAT_Y + 28 + 10;
    for (let k = 0; k < 4; k++) set(Math.round(fx), ry + k, Math.round(fz), k >= 2 ? COPPER : STONE3);
    set(Math.round(fx), ry + 4, Math.round(fz), GOLD);
  }
  addLight(GHX, PLAT_Y + 8, GHZ, 1.2);

  /* ── Bridges & stairs ── */
  bridge({ x0: PX(1340), z0: PZ(1170), x1: PX(1250), z1: PZ(1465), y: PLAT_Y, pierEvery: 6, lantEvery: 4 });
  bridge({ x0: PX(1145), z0: PZ(1215), x1: PX(1205), z1: PZ(1160), y: PLAT_Y + 12, cover: true, pierEvery: 4 });
  stairPath([[1330, 1590], [1370, 1690], [1470, 1700], [1500, 1630], [1600, 1600], [1690, 1600], [1760, 1650]],
            PLAT_Y, LAKE_Y + 2, 3, 5);
  addLight(PF(1500), QZ(1640), PLAT_Y - 20, 0.7);

  /* ── Boathouse ── */
  hall({ cx: PF(1805), cz: QZ(1700), ang: 90, hl: 6, hw: 3, h: 8, y0: LAKE_Y + 3, roofH: 4, litP: 0.7 });
  roundTower({ x: PF(1812), z: QZ(1693), r: 2.2, y0: LAKE_Y + 3, h: 10, cone: 7, litP: 0.6 });
  bridge({ x0: PF(1801), z0: QZ(1708), x1: PF(1799), z1: QZ(1718), y: LAKE_Y + 1, wood: true, lantEvery: 6 });
  bridge({ x0: PF(1809), z0: QZ(1708), x1: PF(1811), z1: QZ(1719), y: LAKE_Y + 1, wood: true, lantEvery: 6 });
  addLight(PF(1805), LAKE_Y + 8, QZ(1700), 1.1);

  addLight(30, 74, 160, 0.9);          /* stone circle glow */
}
