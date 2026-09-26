
// ============================================================================
// 6. ARCHITECTURE KIT
// ============================================================================
let BID = 1;
const litWin = (a, b, c, id, p, bright = WIN) => hash(a + id * 31, b * 7 + id, c) < p * 0.72 ? bright : WINDK;

function foundation(cx, cz, ang, hl, hw, y0, m = STONE2) {
  oriented2D(cx, cz, ang, hl, hw, (x, z) => dropFill(x, y0 - 1, z, m, 70));
}

// Rectangular building. u runs along the length (hl = half length), v across (hw = half width).
// roof: 'gable' (ridge along u), 'hip' (pyramid/spire when hl == hw), 'flat' (battlements).
function hall(o) {
  const { cx, cz, ang = 0, hl, hw, y0 = PLAT_Y, h, roof = 'gable', win = 'normal', ev = 3, floorH = 6,
    buttress = 0, crenel = false, machi = false, dormers = false, litP = 0.5, stone = STONE, trim = STONE3,
    roofMat = ROOF, found = true, gableWin = true, bright = WIN, arches = false } = o;
  const roofH = o.roofH ?? (roof === 'flat' ? 1 : hw + 2);
  const id = BID++;
  if (found) foundation(cx, cz, ang, hl, hw, y0);
  const ext = 1;
  oriented(cx, cz, ang, hl + ext, hw + ext, y0, y0 + h + roofH + 1, (u, v, y) => {
    const au = Math.abs(u), av = Math.abs(v), r = y - y0;
    const inside = au <= hl && av <= hw;
    if (r < h) {
      if (inside) {
        const eV = av === hw, eU = au === hl;
        if (!eV && !eU) return stone;
        if (eV && eU) return ((r >> 1) & 1) ? trim : STONE2;           // quoins
        if (r < 2) return STONE2;                                       // plinth
        const t = eV ? u : v, ex = eV ? hl : hw;
        if (arches && r < 5 && eV && mod(t, 3) !== 0 && au < hl - 1) return r === 4 ? trim : 0; // open arcade
        if (win !== 'none' && Math.abs(t) <= ex - 2 && mod(t, ev) === 0) {
          if (win === 'gothic') {
            const seg = mod(r - 4, 9);
            if (r >= 4 && r <= h - 5 && seg <= 5) return litWin(t, Math.floor((r - 4) / 9), eV ? v : u, id, litP, bright);
            if (r === h - 4 || r === 3 || (r > 4 && seg === 6)) return trim;
          } else {
            const fy = mod(r - 2, floorH);
            if ((fy === 2 || fy === 3) && r < h - 2) return litWin(t, Math.floor((r - 2) / floorH), eV ? v : u, id, litP, bright);
            if (fy === 1) return trim;
          }
        }
        if (win === 'normal' && mod(r - 2, floorH) === 0 && r > 2) return STONE2; // string course
        return stone;
      }
      // ring just outside the wall
      if (buttress && av === hw + 1 && au <= hl - 1 && mod(u, buttress) === 0 && r < h - 1)
        return r === h - 2 ? trim : STONE2;
      if (machi && r >= h - 2 && au <= hl + 1 && av <= hw + 1) return trim;
      return 0;
    }
    const k = r - h;
    if (roof === 'flat') {
      const lim = machi ? 1 : 0;
      if (k === 0 && (crenel || machi)) {
        const onEdge = (au === hl + lim && av <= hw + lim) || (av === hw + lim && au <= hl + lim);
        if (onEdge && mod(u + v, 2) === 0) return trim;
      }
      if (k === 0 && inside && roofMat !== ROOF) return roofMat;
      return 0;
    }
    const sv = (hw + 1) * (1 - k / roofH);
    if (sv < 0) return 0;
    if (roof === 'hip') {
      const su = hl - hw + sv;
      if (av > sv + 0.01 || au > su + 0.01) return 0;
      if (sv < 0.9) return k >= roofH - 2 ? COPPER : ROOF2;
      if (dormers && k === 2 && (av > sv - 1) && mod(u, 4) === 0 && au < su - 1) return litWin(u, k, v, id, 0.35);
      return (av > sv - 1 || au > su - 1) && k === 0 ? ROOF2 : roofMat;
    }
    // gable
    if (av > sv + 0.01 || au > hl) return 0;
    if (au === hl && av < sv - 0.99) {
      if (gableWin && av === 0 && k === Math.max(1, Math.floor(roofH / 3))) return litWin(u, k, 9, id, 0.6);
      return stone;
    }
    if (sv < 0.99) return ROOF2;                                    // ridge
    if (k === 0 && av > sv - 1) return ROOF2;                       // eaves
    if (dormers && (k === 2 || k === 3) && av > sv - 1 && mod(u, 4) === 0 && au < hl - 1)
      return k === 2 ? litWin(u, k, v, id, 0.4) : ROOF2;
    return roofMat;
  });
  return { top: y0 + h, id };
}

// Round tower with optional machicolations, battlements and a stepped cone roof.
function roundTower(o) {
  const { x, z, r, y0 = PLAT_Y, h, cone = true, crenel = false, machi = true, litP = 0.45,
    stone = STONE, roofMat = ROOF, spire = 3, found = true, dormer = true, bright = WIN } = o;
  const coneH = o.coneH ?? Math.round(r * 2.8 + 3);
  const winN = o.winN ?? Math.max(3, Math.round(r * 1.4));
  const id = BID++;
  const rc = Math.ceil(r) + 2, R2 = (r + 0.5) ** 2, Ri2 = (r - 0.5) ** 2;
  if (found) for (let dz = -rc; dz <= rc; dz++) for (let dx = -rc; dx <= rc; dx++)
    if (dx * dx + dz * dz <= R2) dropFill(x + dx, y0 - 1, z + dz, STONE2, 70);
  for (let rel = 0; rel < h; rel++) for (let dz = -rc; dz <= rc; dz++) for (let dx = -rc; dx <= rc; dx++) {
    const d2 = dx * dx + dz * dz;
    if (d2 > R2) {
      if (machi && rel >= h - 2 && d2 <= (r + 1.5) ** 2) set(x + dx, y0 + rel, z + dz, STONE3);
      continue;
    }
    let m = stone;
    if (d2 > Ri2) {
      if (rel < 2) m = STONE2;
      else {
        const a = Math.atan2(dz, dx), seg = (a + Math.PI) / (2 * Math.PI) * winN, fr = seg - Math.floor(seg);
        const fy = mod(rel - 3, 7);
        if (Math.abs(fr - 0.5) * (2 * Math.PI * r / winN) < 0.6 && rel < h - 3) {
          if (fy === 1 || fy === 2) m = litWin(Math.floor(seg), Math.floor((rel - 3) / 7), 0, id, litP, bright);
          else if (fy === 0) m = STONE3;
        }
      }
    }
    set(x + dx, y0 + rel, z + dz, m);
  }
  const top = y0 + h;
  if (crenel) {
    const rr0 = machi ? r + 1 : r;
    for (let dz = -rc; dz <= rc; dz++) for (let dx = -rc; dx <= rc; dx++) {
      const d2 = dx * dx + dz * dz;
      if (d2 <= (rr0 + 0.5) ** 2 && d2 > (rr0 - 0.5) ** 2 && mod(dx + dz, 2) === 0) set(x + dx, top, z + dz, STONE3);
    }
  }
  if (cone) {
    const R0 = crenel ? r - 0.6 : r + 1.2;
    for (let k = 0; k < coneH; k++) {
      const rk = R0 * Math.pow(1 - k / coneH, 1.08), rq = (rk + 0.35) ** 2, rin = (rk - 0.8) ** 2;
      const n = Math.ceil(rk) + 1;
      for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > rq) continue;
        let m = roofMat;
        if (k === 0 && d2 > rin) m = ROOF2;
        else if (dormer && d2 > rin && mod(k, 6) === 4 && k < coneH * 0.72) {
          const a = Math.atan2(dz, dx), seg = (a + Math.PI) / (2 * Math.PI) * 8, fr = seg - Math.floor(seg);
          if (Math.abs(fr - 0.5) < 0.12 + 0.2 / Math.max(1, rk)) m = litWin(Math.floor(seg), k, 5, id, 0.3);
        }
        set(x + dx, top + k + (crenel ? 1 : 0), z + dz, m);
      }
    }
    const st = top + coneH + (crenel ? 1 : 0);
    for (let i = 0; i < spire; i++) set(x, st + i, z, i === spire - 1 ? COPPER : ROOF2);
  } else if (!crenel) disk(x, z, r, top, ROOF2);
  return { top };
}

// Square tower: a hall with a hip roof; tall roofH gives a spire. Optional corner pinnacles.
function squareTower(o) {
  const { x, z, s, h, roofH = s * 3, pinnacles = false, y0 = PLAT_Y, ang = 0 } = o;
  const res = hall({ ...o, cx: x, cz: z, hl: s, hw: s, roof: 'hip', roofH, ev: o.ev ?? 3, y0, ang });
  if (pinnacles) for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const [px, pz] = toWorld(x, z, ang, su * (s + 1), sv * (s + 1));
    const ph = o.pinH ?? 7;
    box(px, y0 + h - 4, pz, px, y0 + h + 1, pz, STONE3);
    for (let i = 0; i < ph; i++) set(px, y0 + h + 2 + i, pz, i === ph - 1 ? COPPER : ROOF);
  }
  return res;
}

// Covered or open bridge between two points. deck at y. kind: 'stone' | 'wood'.
function bridge(o) {
  const { x0, z0, x1, z1, y, w = 2, kind = 'stone', roof = false, pierEvery = 6, lanterns = 0, truss = false } = o;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ang = Math.atan2(z1 - z0, x1 - x0);
  const hl = Math.round(Math.hypot(x1 - x0, z1 - z0) / 2);
  const deck = kind === 'wood' ? WOOD2 : STONE3, wall = kind === 'wood' ? WOOD : STONE;
  oriented2D(cx, cz, ang, hl, w + 1, (x, z, u, v) => {
    const av = Math.abs(v);
    set(x, y, z, av <= w ? deck : wall);
    set(x, y - 1, z, kind === 'wood' ? WOOD : STONE2);
    if (av === w + 1) {
      set(x, y + 1, z, wall);
      if (roof) { set(x, y + 2, z, (kind === 'wood' && mod(u, 3) !== 0) ? (hash(u, 1, v) < 0.5 ? LANT : 0) : wall); set(x, y + 3, z, wall); }
      else if (kind === 'stone' && mod(u, 2) === 0) set(x, y + 2, z, STONE3);
      if (lanterns && mod(u, lanterns) === 0) { set(x, y + 2, z, IRON); set(x, y + 3, z, LANT); }
    }
    if (roof) for (let k = 0; k <= w + 2; k++) if (av <= w + 2 - k) set(x, y + 4 + k, z, (av === w + 2 - k) ? ROOF2 : (kind === 'wood' ? WOOD : ROOF));
    if (mod(u, pierEvery) === 0 && Math.abs(u) < hl) {
      if (truss) { if (av === w) dropFill(x, y - 2, z, WOOD, 45); }
      else if (av <= w) dropFill(x, y - 2, z, STONE2, 70);
    } else if (!truss && kind === 'stone') {
      // arch: a few voxels of masonry under the deck that shrink toward mid-span
      const p = mod(u, pierEvery), mid = Math.min(p, pierEvery - p);
      for (let k = 2; k < 2 + Math.max(0, 3 - mid); k++) set(x, y - k, z, STONE2);
    }
  });
  if (truss) { // diagonal lattice under the wooden bridge
    for (let u = -hl; u < hl; u += 4) for (const sv of [-w, w]) {
      const [ax, az] = toWorld(cx, cz, ang, u, sv), [bx, bz] = toWorld(cx, cz, ang, u + 4, sv);
      line3(ax, y - 2, az, bx, y - 8, bz, WOOD); line3(bx, y - 2, bz, ax, y - 8, az, WOOD);
      line3(ax, y - 8, az, bx, y - 8, bz, WOOD);
    }
  }
}

// Staircase following a polyline of [x,z] points, descending from yA to yB.
function stairPath(pts, yA, yB, w = 1, lantEvery = 7) {
  let total = 0; const seg = [];
  for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(L); total += L; }
  let acc = 0, step = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = seg[i - 1], n = Math.ceil(L * 2);
    const nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let j = 0; j <= n; j++) {
      const t = j / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      const y = Math.round(yA + (yB - yA) * ((acc + L * t) / total));
      for (let k = -w - 1; k <= w + 1; k++) {
        const x = Math.round(px + nx * k), z = Math.round(pz + nz * k);
        for (let c = 1; c <= 5; c++) if (get(x, y + c, z) !== 0 && PAL[get(x, y + c, z)].kind !== 2) setAir(x, y + c, z);
        dropFill(x, y, z, STONE2, 60);
        set(x, y, z, Math.abs(k) <= w ? STONE3 : STONE2);
        if (Math.abs(k) === w + 1) set(x, y + 1, z, STONE);
      }
      if (++step % (lantEvery * 2) === 0) {
        const x = Math.round(px + nx * (w + 1)), z = Math.round(pz + nz * (w + 1));
        set(x, y + 2, z, IRON); set(x, y + 3, z, LANT); LIGHTS.small.push([x, y + 3, z]);
      }
    }
    acc += L;
  }
}

// Lights collected while building (turned into a few point lights later).
const LIGHTS = { warm: [], small: [] };
