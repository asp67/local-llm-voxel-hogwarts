/* ============================================================
   03_buildings.js — architecture kit (PROJECT.md §7)
   All buildings are functions of local coordinates; rotated
   ones go through oriented2D so they stay crisp voxel art.
   ============================================================ */

// tower radius given large (>= 20) is a plan-pixel value, small is voxels
const rad = r => (r >= 20 ? r * S : r);
// a lit lantern on a short black post
function lantern(x, y, z) {
  if (!inb(x, y, z)) return;
  set(x, y, z, PAL.BLACK);
  set(x, y + 1, z, PAL.LANT);
}
// taller courtyard lamp post
function lampPost(x, y, z) {
  if (!inb(x, y, z)) return;
  set(x, y, z, PAL.BLACK);
  set(x, y + 1, z, PAL.BLACK);
  set(x, y + 2, z, PAL.LANT);
}
// masonry pier that reaches the ground or the lake bed
function pierSupport(x, z, yFrom) {
  for (let y = yFrom; y >= 0; y--) {
    const m = get(x, y, z);
    if (m !== 0 && m !== PAL.WATER) break;
    set(x, y, z, PAL.STONE2);
  }
}

/* ------------------------------------------------------------
   hall(o) — rectangular building (optionally rotated)
   o: cx, cz, ang, hl, hw, y0, h, roof('gable'|'hip'|'flat'),
      roofH, win('normal'|'gothic'|'none'), winMat, ev, floorH,
      buttress, crenel, machi, dormers, litP, arches, stone, trim,
      roofMat, bright
   ------------------------------------------------------------ */
function hall(o) {
  const cx = o.cx, cz = o.cz, ang = o.ang || 0;
  const hl = Math.round(o.hl), hw = Math.round(o.hw);
  const y0 = o.y0 !== undefined ? o.y0 : PLAT_Y;
  const h = o.h || 20;
  const roof = o.roof || 'gable';
  const roofH = o.roofH !== undefined ? o.roofH : hw + 2;
  const winMode = o.win || 'normal';
  const winMat = o.winMat !== undefined ? o.winMat : PAL.WIN;
  const ev = o.ev !== undefined ? o.ev : 3;
  const floorH = o.floorH || 6;
  const buttress = o.buttress || 0;
  const crenel = !!o.crenel, machi = !!o.machi;
  const dormers = !!o.dormers;
  const litP = Math.min(1, (o.litP !== undefined ? o.litP : 0.9) + (o.bright ? 0.15 : 0));
  const stone = o.stone !== undefined ? o.stone : PAL.STONE;
  const trim = o.trim !== undefined ? o.trim : PAL.STONE3;
  const roofMat = o.roofMat !== undefined ? o.roofMat : PAL.ROOF;
  const arches = !!o.arches;
  const yTop = y0 + h - 1;
  const lit = (x, y, z) => (hash(x, y, z) < litP * 0.72) ? winMat : PAL.WINDK;

  // ---- footprint: foundation + solid walls, plinth, quoins ----
  const cols = [];
  oriented2D(cx, cz, ang, hl, hw, (u, v, x, z) => {
    cols.push([u, v, x, z]);
    dropFill(x, z, y0 - 1, PAL.STONE2, 70);
    const quoin = Math.abs(u) >= hl - 1 && Math.abs(v) >= hw - 1;
    for (let y = y0; y <= yTop; y++) {
      let m = stone;
      if (y <= y0 + 1) m = PAL.STONE2;                       // plinth
      else if (quoin) m = (Math.floor((y - y0) / 2) % 2 === 0) ? trim : PAL.STONE2;
      set(x, y, z, m);
    }
  });
  const isShell = (u, v) => Math.abs(u) === hl || Math.abs(v) === hw;

  // ---- string course at every floor ----
  for (let f = 1; y0 + f * floorH <= yTop; f++) {
    const y = y0 + f * floorH;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (isShell(c[0], c[1])) set(c[2], y, c[3], PAL.STONE2);
    }
  }

  // ---- windows / arcade ----
  if (winMode !== 'none' && ev > 0) {
    for (let i = 0; i < cols.length; i++) {
      const u = cols[i][0], v = cols[i][1], x = cols[i][2], z = cols[i][3];
      if (!isShell(u, v)) continue;
      // spacing runs along whichever axis the wall face extends in
      let pos, lim;
      if (Math.abs(v) === hw) { pos = u; lim = hl; }
      else { pos = v; lim = hw; }
      if (Math.abs(pos) > lim - 2) continue;                 // not within 2 of a corner
      if (Math.abs(pos) % ev !== 0) continue;
      for (let f = 0; ; f++) {
        const fy = y0 + f * floorH;
        if (fy + 3 > yTop) break;
        if (arches && f === 0) {                             // open ground-floor arcade
          for (let y = fy + 1; y <= fy + floorH - 2 && y <= yTop; y++) set(x, y, z, 0);
          if (fy + floorH - 1 <= yTop) set(x, fy + floorH - 1, z, trim);
          continue;
        }
        if (winMode === 'gothic') {
          for (let y = fy + 1; y <= Math.min(fy + 6, yTop); y++) {
            set(x, y, z, ((y - y0) % 9 === 8) ? trim : lit(x, y, z));   // lancet + transom
          }
        } else {
          if (fy + 1 <= yTop) set(x, fy + 1, z, trim);                   // sill
          if (fy + 2 <= yTop) set(x, fy + 2, z, lit(x, fy + 2, z));
          if (fy + 3 <= yTop) set(x, fy + 3, z, lit(x, fy + 3, z));
        }
      }
    }
  }

  // ---- buttresses outside the long walls ----
  if (buttress > 0) {
    for (let u = -hl; u <= hl; u++) {
      if (Math.abs(u) > hl - 1) continue;
      if (Math.abs((u + hl) % buttress) !== 0) continue;
      for (const s of [1, -1]) {
        const w2 = toWorld(cx, cz, ang, u, s * (hw + 1));
        const x = w2[0], z = w2[1];
        if (!inb(x, 0, z)) continue;
        dropFill(x, z, y0 - 1, PAL.STONE2, 70);
        for (let y = y0; y <= yTop; y++) set(x, y, z, PAL.STONE2);
        if (yTop + 1 < H) set(x, yTop + 1, z, trim);
      }
    }
  }

  // ---- roofs ----
  const roofCell = (u, v, x, z, y, m) => { if (y < H) set(x, y, z, m); };
  if (roof === 'gable') {
    for (let k = 0; k <= roofH; k++) {
      const y = y0 + h + k;
      if (y >= H) break;
      const lim = Math.floor((hw + 1) * (1 - k / roofH));
      oriented2D(cx, cz, ang, hl + 1, hw + 1, (u, v, x, z) => {
        if (Math.abs(u) > hl || Math.abs(v) > lim) return;
        let m;
        if (Math.abs(u) === hl && k > 0) {
          m = trim;                                           // stone gable end
          if (v === 0 && k === Math.max(1, Math.floor(roofH / 2))) m = PAL.WIN;
        } else if (k === 0) m = PAL.ROOF2;                   // eave row
        else if (v === 0 && k >= roofH - 1) m = PAL.ROOF2;   // ridge
        else m = roofMat;
        if (dormers && Math.abs(u) < hl && ((u + hl) % 4) === 2 && Math.abs(v) === lim) {
          if (k === 2) m = lit(x, y, z);                     // dormer window
          else if (k === 3) m = PAL.ROOF2;                   // dormer cap
        }
        roofCell(u, v, x, z, y, m);
      });
    }
  } else if (roof === 'hip') {
    for (let k = 0; k <= roofH; k++) {
      const y = y0 + h + k;
      if (y >= H) break;
      const limV = Math.floor((hw + 1) * (1 - k / roofH));
      const limU = Math.floor((hl + 1) * (1 - k / roofH));
      const tip = (k === roofH);
      const spireTip = roofH >= (hw + 1) * 2;
      oriented2D(cx, cz, ang, hl + 1, hw + 1, (u, v, x, z) => {
        if (Math.abs(u) > limU || Math.abs(v) > limV) return;
        let m = (k === 0) ? PAL.ROOF2 : roofMat;
        if (tip) m = spireTip ? PAL.COPPER : PAL.ROOF2;
        roofCell(u, v, x, z, y, m);
      });
    }
  }

  // ---- machicolation ring + battlements ----
  if (machi) {
    oriented2D(cx, cz, ang, hl + 1, hw + 1, (u, v, x, z) => {
      if (Math.abs(u) <= hl && Math.abs(v) <= hw) return;     // ring only, outside the walls
      for (let y = yTop - 1; y <= yTop; y++) if (y < H) set(x, y, z, PAL.STONE2);
    });
  }
  if (crenel || roof === 'flat') {
    const bl = machi ? hl + 1 : hl, bw = machi ? hw + 1 : hw;
    oriented2D(cx, cz, ang, bl, bw, (u, v, x, z) => {
      if (!(Math.abs(u) === bl || Math.abs(v) === bw)) return;
      if (((u + v) & 1) !== 0) return;                       // alternating merlons
      if (yTop + 1 < H) set(x, yTop + 1, z, trim);
      if (yTop + 2 < H) set(x, yTop + 2, z, trim);
    });
  }
}

/* ------------------------------------------------------------
   roundTower(o) — x, z, r, y0, h, cone, coneH, crenel, machi,
   spire, winN, litP, stone, trim
   ------------------------------------------------------------ */
function roundTower(o) {
  const x = o.x, z = o.z, r = o.r;
  const y0 = o.y0 !== undefined ? o.y0 : PLAT_Y;
  const h = o.h || 20;
  const useCone = o.cone !== false;
  const coneH = o.coneH !== undefined ? o.coneH : Math.round(2.8 * r + 3);
  const crenel = !!o.crenel, machi = !!o.machi;
  const spire = o.spire ? (o.spire === true ? 3 : o.spire) : 0;
  const winN = o.winN || Math.max(4, Math.round(1.4 * r));
  const litP = o.litP !== undefined ? o.litP : 0.75;
  const stone = o.stone !== undefined ? o.stone : PAL.STONE;
  const trim = o.trim !== undefined ? o.trim : PAL.STONE3;
  const roofMat = o.roofMat !== undefined ? o.roofMat : PAL.ROOF;
  const yTop = y0 + h - 1;
  const r2 = r * r;

  // ---- body: plinth, walls, string courses ----
  const cells = [];
  const rad2 = Math.ceil(r) + 1;
  for (let dz = -rad2; dz <= rad2; dz++)
    for (let dx = -rad2; dx <= rad2; dx++) {
      const d = dx * dx + dz * dz;
      if (d > r2) continue;
      const wx = x + dx, wz = z + dz;
      if (!inb(wx, 0, wz)) continue;
      cells.push([dx, dz, d]);
      dropFill(wx, wz, y0 - 1, PAL.STONE2, 70);
      for (let y = y0; y <= yTop; y++) set(wx, y, wz, y <= y0 + 1 ? PAL.STONE2 : stone);
    }
  for (let f = 1; y0 + f * 6 <= yTop; f++) {                  // ring string courses
    const y = y0 + f * 6;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (c[2] >= r2 - (2 * r + 1)) set(x + c[0], y, z + c[1], PAL.STONE2);
    }
  }

  // ---- slit windows every 7 rows ----
  for (let s = 0; s < winN; s++) {
    const a = (s / winN) * TAU;
    const wx = Math.round(x + Math.cos(a) * r), wz = Math.round(z + Math.sin(a) * r);
    if ((wx - x) * (wx - x) + (wz - z) * (wz - z) > r2) continue;
    for (let wy = y0 + 4; wy <= yTop; wy += 7) {
      if (wy - 1 >= y0) set(wx, wy - 1, wz, trim);            // sill
      for (let k = 0; k < 2 && wy + k <= yTop; k++)
        set(wx, wy + k, wz, hash(wx, wy + k, wz) < litP * 0.72 ? PAL.WIN : PAL.WINDK);
    }
  }

  // ---- machicolation ring + battlement ----
  const ringR2 = (r + 1) * (r + 1);
  if (machi) {
    for (let dz = -rad2 - 1; dz <= rad2 + 1; dz++)
      for (let dx = -rad2 - 1; dx <= rad2 + 1; dx++) {
        const d = dx * dx + dz * dz;
        if (d <= r2 || d > ringR2) continue;
        for (let y = yTop - 1; y <= yTop; y++) if (y < H) set(x + dx, y, z + dz, PAL.STONE2);
      }
  }
  if (crenel) {
    const nB = Math.max(10, Math.round(TAU * Math.max(r, 1.5)));
    const band = [];
    for (let i = 0; i < cells.length; i++)
      if (cells[i][2] >= (r - 1) * (r - 1) && cells[i][2] <= ringR2) band.push(cells[i]);
    for (let i = 0; i < band.length; i++)                     // continuous parapet course
      if (yTop + 1 < H) set(x + band[i][0], yTop + 1, z + band[i][1], trim);
    for (let b = 0; b < nB; b += 2) {                         // alternating merlons
      const a = (b + 0.5) / nB * TAU;
      const mx = x + Math.round(Math.cos(a) * (r - 0.3));
      const mz = z + Math.round(Math.sin(a) * (r - 0.3));
      if ((mx - x) * (mx - x) + (mz - z) * (mz - z) > r2) continue;
      if (yTop + 2 < H) set(mx, yTop + 2, mz, trim);
    }
  }

  // ---- stepped cone roof ----
  if (useCone) {
    const baseY = (crenel ? yTop + 3 : yTop + 1);
    const R0 = crenel ? Math.max(1, r - 0.6) : r + 1.2;
    const coneCells = [];
    for (let k = 0; k <= coneH; k++) {
      const y = baseY + k;
      if (y >= H) break;
      const rr = R0 * Math.pow(Math.max(0, 1 - k / coneH), 1.08);
      const cr2 = rr * rr;
      const lim = Math.ceil(rr);
      for (let dz = -lim; dz <= lim; dz++)
        for (let dx = -lim; dx <= lim; dx++) {
          if (dx * dx + dz * dz > cr2) continue;
          let m = roofMat;
          if (k === 0) m = PAL.ROOF2;                          // eave ring
          else if (k === coneH || (rr < 0.8 && k === coneH - 1)) m = PAL.COPPER;
          set(x + dx, y, z + dz, m);
        }
      if (k < coneH && rr >= 1.5) coneCells.push([k, y, rr]);
    }
    // tiny lit dormers on the cone every 6 rows, 8 per ring
    for (let i = 0; i < coneCells.length; i++) {
      const c = coneCells[i];
      if (c[0] % 6 !== 0 || c[0] === 0) continue;
      for (let s = 0; s < 8; s++) {
        const a = (s + 0.5) / 8 * TAU;
        const wx = x + Math.round(Math.cos(a) * c[2]);
        const wz = z + Math.round(Math.sin(a) * c[2]);
        if ((wx - x) * (wx - x) + (wz - z) * (wz - z) > c[2] * c[2] + 1) continue;
        set(wx, c[1], wz, hash(wx, c[1], wz) < 0.6 * 0.72 ? PAL.WIN : PAL.WINDK);
      }
    }
    // spire column ending in copper
    if (spire) {
      for (let k = 1; k <= spire; k++) {
        const y = baseY + coneH + k;
        if (y >= H) break;
        set(x, y, z, k === spire ? PAL.COPPER : PAL.ROOF2);
      }
    }
  }
}

/* ------------------------------------------------------------
   squareTower(o) — a hall with hl = hw = s and a hip roof,
   plus optional corner pinnacles (trim shaft + spike + copper).
   o: cx, cz, ang, s, y0, h, roofH, pinnacles, win, crenel, machi…
   ------------------------------------------------------------ */
function squareTower(o) {
  const p = Object.assign({}, o, { hl: o.s, hw: o.s, roof: o.roof || 'hip' });
  hall(p);
  if (o.pinnacles) {
    const n = o.pinnacles === true ? 4 : o.pinnacles;
    const y0 = o.y0 !== undefined ? o.y0 : PLAT_Y;
    const yBase = y0 + (o.h || 20);
    const s = Math.round(o.s), ang = o.ang || 0;
    for (const c of [[s, s], [s, -s], [-s, s], [-s, -s]]) {
      const w2 = toWorld(o.cx, o.cz, ang, c[0], c[1]);
      const x = w2[0], z = w2[1];
      if (!inb(x, 0, z)) continue;
      for (let y = yBase; y < yBase + n && y < H; y++) set(x, y, z, PAL.STONE3);
      if (yBase + n < H) set(x, yBase + n, z, PAL.ROOF2);
      if (yBase + n + 1 < H) set(x, yBase + n + 1, z, PAL.ROOF2);
      if (yBase + n + 2 < H) set(x, yBase + n + 2, z, PAL.COPPER);
    }
  }
}

/* ------------------------------------------------------------
   bridge(o) — x0,z0 → x1,z1 at deck height y, width w.
   stone: piers every pierEvery + shallow arch masonry
   truss: posts + diagonal lattice (wooden covered bridge)
   ------------------------------------------------------------ */
function bridge(o) {
  const x0 = o.x0, z0 = o.z0, x1 = o.x1, z1 = o.z1;
  const y = o.y;
  const w = o.w || 3;
  const truss = !!o.truss;
  const deckM = o.deck !== undefined ? o.deck : (truss ? PAL.WOOD2 : PAL.STONE3);
  const parapet = o.parapet !== false && !o.roof;
  const lantEvery = o.lanterns || 0;
  const cov = o.roof;
  const pierEvery = o.pierEvery || 0;
  const archH = o.arch !== undefined ? o.arch : (truss ? 0 : 3);

  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  const nx = -dz / len, nz = dx / len;
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0), 1);
  const bay = pierEvery > 0 ? pierEvery : 5;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bx = lerp(x0, x1, t), bz = lerp(z0, z1, t);
    for (let j = 0; j < w; j++) {
      const off = j - (w - 1) / 2;
      const px = Math.round(bx + nx * off), pz = Math.round(bz + nz * off);
      set(px, y, pz, deckM);
      if (cov) {                                               // enclosed corridor walls
        if (j === 0 || j === w - 1) {
          set(px, y + 1, pz, truss ? PAL.WOOD : PAL.STONE2);
          set(px, y + 2, pz, truss ? PAL.WOOD : PAL.STONE2);
        }
      } else if (parapet && (j === 0 || j === w - 1)) {
        set(px, y + 1, pz, truss ? PAL.WOOD : PAL.STONE2);
        if (lantEvery > 0 && i % lantEvery === 0 && j === 0) lantern(px, y + 2, pz);
      }
    }
    // substructure
    if (truss) {
      if (i % bay === 0) {                                     // posts down to the ground
        for (let j = 0; j < w; j += w - 1) {
          const off = j - (w - 1) / 2;
          const px = Math.round(bx + nx * off), pz = Math.round(bz + nz * off);
          dropFill(px, pz, y - 1, PAL.WOOD, 70);
        }
      }
      // diagonal lattice: crossing chords under the deck
      const ph = (i % bay) / bay;
      const saw = p => (p < 0.5 ? p * 2 : 2 - p * 2);
      const dA = Math.round(4 * saw(ph));
      const dB = Math.round(4 * saw((ph + 0.5) % 1));
      const dep = Math.max(dA, dB);
      for (let d = 1; d <= dep; d++) {
        for (let j = 0; j < w; j++) {
          const off = j - (w - 1) / 2;
          const px = Math.round(bx + nx * off), pz = Math.round(bz + nz * off);
          if (d <= dA || d <= dB) set(px, y - d, pz, PAL.WOOD);
        }
      }
    } else if (pierEvery > 0) {
      if (i % pierEvery === 0) {                               // piers
        for (let j = 0; j < w; j++) {
          const off = j - (w - 1) / 2;
          const px = Math.round(bx + nx * off), pz = Math.round(bz + nz * off);
          dropFill(px, pz, y - 1, PAL.STONE2, 70);
        }
      } else if (archH > 0) {                                  // shallow arch masonry
        const ph = (i % pierEvery) / pierEvery;
        const dep = Math.max(0, Math.round(archH * Math.sin(Math.PI * ph)));
        for (let d = 1; d <= dep; d++)
          for (let j = 0; j < w; j++) {
            const off = j - (w - 1) / 2;
            const px = Math.round(bx + nx * off), pz = Math.round(bz + nz * off);
            set(px, y - d, pz, PAL.STONE2);
          }
      }
    }
  }

  // covered gable roof
  if (cov) {
    const rh = cov === true ? 3 : cov;
    const rw = Math.ceil(w / 2);
    for (let k = 0; k <= rh; k++) {
      const yv = y + 3 + k;
      if (yv >= H) break;
      const lim = Math.floor((rw + 1) * (1 - k / rh));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const bx = lerp(x0, x1, t), bz = lerp(z0, z1, t);
        for (let j = 0; j < w; j++) {
          const off = j - (w - 1) / 2;
          if (Math.abs(off) > lim) continue;
          const px = Math.round(bx + nx * off), pz = Math.round(bz + nz * off);
          set(px, yv, pz, (k === 0 || Math.abs(off) === lim && k === rh) ? PAL.ROOF2 : PAL.ROOF);
        }
      }
    }
  }
}

/* ------------------------------------------------------------
   stairPath(pts, yA, yB, w, lantEvery) — lantern staircase.
   Walks a polyline, interpolates height yA → yB, carves 5 voxels
   of headroom, drops stone supports to the ground or lake bed,
   adds parapets and lantern posts.
   ------------------------------------------------------------ */
function stairPath(pts, yA, yB, w = 3, lantEvery = 5) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const L = Math.max(Math.abs(pts[i + 1][0] - pts[i][0]),
                       Math.abs(pts[i + 1][1] - pts[i][1]), 1);
    segs.push(L); total += L;
  }
  let walked = 0, stepNo = 0;
  for (let s = 0; s < segs.length; s++) {
    const x0 = pts[s][0], z0 = pts[s][1], x1 = pts[s + 1][0], z1 = pts[s + 1][1];
    const L = segs[s];
    const dx = x1 - x0, dz = z1 - z0;
    const ll = Math.sqrt(dx * dx + dz * dz) || 1;
    const nx = -dz / ll, nz = dx / ll;
    for (let i = 0; i < L; i++) {
      const g = (walked + i) / total;
      const t = i / L;
      const bx = lerp(x0, x1, t), bz = lerp(z0, z1, t);
      const y = Math.round(lerp(yA, yB, g));
      for (let j = 0; j < w; j++) {
        const off = j - (w - 1) / 2;
        const px = Math.round(bx + nx * off), pz = Math.round(bz + nz * off);
        if (!inb(px, y, pz)) continue;
        set(px, y, pz, PAL.STONE3);                            // step deck
        if (j === 0 || j === w - 1) {
          set(px, y + 1, pz, PAL.STONE2);                      // parapet
          pierSupport(px, pz, y - 1);                          // pier to bed / ground
        } else {
          for (let c = 1; c <= 5; c++) set(px, y + 1 + c, pz, 0); // headroom
        }
      }
      if (lantEvery > 0 && stepNo % lantEvery === 0) {
        const side = (Math.floor(stepNo / lantEvery) % 2 === 0) ? 0 : w - 1;
        const off = side - (w - 1) / 2;
        const px = Math.round(bx + nx * off), pz = Math.round(bz + nz * off);
        lantern(px, y + 2, pz);
      }
      stepNo++;
    }
    walked += L;
  }
}