/* ════════════════════════════════════════════════════════════════════
   03_buildings.js — architecture kit
   hall(), roundTower(), squareTower(), bridge(), stairPath()
   All centres/sizes in voxel coordinates; angles in degrees.
   ════════════════════════════════════════════════════════════════════ */

function lampPost(x, z, y) {                 /* y = ground-level top voxel */
  set(x, y + 1, z, IRON); set(x, y + 2, z, IRON); set(x, y + 3, z, LANT);
}

function fountain(x, z, y) {
  fillDisk(x, z, y + 1, 3.5, STONE2);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
    if (dx * dx + dz * dz <= 6.5) set(x + dx, y + 1, z + dz, WATER);
  set(x, y + 2, z, STONE3); set(x, y + 3, z, STONE3); set(x, y + 4, z, LANT);
}

function lanternWire(x, z, y) { set(x, y + 1, z, IRON); set(x, y + 2, z, LANT); }

/* ── rectangular building ─────────────────────────────────────────── */
function hall(o) {
  const hl = o.hl, hw = o.hw, cx = o.cx, cz = o.cz, ang = (o.ang ?? 0) * DR;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const y0 = o.y0 ?? PLAT_Y, h = o.h ?? 8, floorH = o.floorH ?? 6;
  const roof = o.roof ?? 'gable', roofH = o.roofH ?? Math.max(2, Math.round(hw + 2));
  const stone = o.stone ?? STONE, trim = o.trim ?? STONE3;
  const win = o.win ?? 'normal', ev = o.ev ?? 3, litP = o.litP ?? 0.5, litM = o.winMat ?? WIN;
  const y1 = y0 + h - 1;
  const diag = Math.ceil(Math.hypot(hl, hw)) + 2;
  const W2 = (u, v) => [cx + u * ca - v * sa, cz + u * sa + v * ca];

  /* body + foundation + perimeter detail */
  for (let zz = -diag; zz <= diag; zz++) for (let xx = -diag; xx <= diag; xx++) {
    const x = Math.round(cx + xx), z = Math.round(cz + zz);
    if (x < 0 || x >= W || z < 0 || z >= D) continue;
    const rx = x - cx, rz = z - cz;
    const u = rx * ca + rz * sa, v = -rx * sa + rz * ca;
    if (u < -hl - 0.49 || u > hl + 0.49 || v < -hw - 0.49 || v > hw + 0.49) continue;
    const edge = Math.abs(u) > hl - 0.52 || Math.abs(v) > hw - 0.52;
    const onSide = Math.abs(v) > hw - 0.52, onEnd = Math.abs(u) > hl - 0.52;
    const corner = Math.abs(u) > hl - 1.49 && Math.abs(v) > hw - 1.49;
    const ui = Math.round(u), vi = Math.round(v);

    for (let y = y0; y <= y1; y++) {
      let m = stone; const yy = y - y0;
      if (edge) {
        if (yy < 2) m = STONE2;
        else if (corner) m = ((yy >> 1) & 1) ? STONE2 : STONE3;
        else if (yy % floorH === 0) m = STONE2;
      }
      set(x, y, z, m);
    }
    for (let y = y0 - 1; y > y0 - 72; y--) { if (get(x, y, z)) break; set(x, y, z, STONE2); }

    /* windows on the perimeter ring */
    if (edge && (win === 'normal' || win === 'gothic') && !corner) {
      if ((onSide && Math.abs(ui) > 1.9 && Math.abs(ui) <= hl - 1.9 && ((ui % ev) + ev * 20) % ev === 0) ||
          (onEnd && hl >= 5 && Math.abs(vi) > 1.9 && Math.abs(vi) <= hw - 1.9 && ((vi % ev) + ev * 20) % ev === 0)) {
        for (let fi = 0; fi <= Math.floor(h / floorH); fi++) {
          const yw = y0 + fi * floorH;
          if (o.arches && yw < y0 + 6) continue;        /* arcade owns ground floor */
          if (win === 'normal') {
            set(x, yw + 1, z, trim);                    /* sill */
            for (let k = 2; k <= 3; k++) {
              const y = yw + k;
              if (y >= y0 + 3 && y <= y1 - 1)
                set(x, y, z, hash(x, y, z, 3) < litP * 0.72 ? litM : WINDK);
            }
          } else if (yw + 7 <= y1) {                    /* gothic lancets */
            for (let k = 1; k <= 6; k++)
              set(x, yw + k, z, hash(x, yw + k, z, 3) < litP * 0.72 ? litM : WINDK);
            set(x, yw + 7, z, trim);                    /* transom */
          }
        }
      }
    }
    /* open ground-floor arcade */
    if (o.arches && onSide && !corner && Math.abs(ui) > 1.9 && Math.abs(ui) <= hl - 2.9 &&
        ((ui % 2) + 2) % 2 === 1)
      for (let y = y0 + 2; y <= Math.min(y0 + 5, y1 - 2); y++) set(x, y, z, 0);
  }

  /* buttresses on the long walls */
  if (o.buttress) for (const side of [1, -1]) for (let ui = -Math.round(hl) + 1; ui <= hl - 1; ui++) {
    if ((ui % o.buttress + o.buttress) % o.buttress !== 0 || Math.abs(ui) >= hl - 2) continue;
    const [bx, bz] = W2(ui, side * (hw + 1));
    const xi = Math.round(bx), zi = Math.round(bz);
    if (xi < 0 || xi >= W || zi < 0 || zi >= D) continue;
    for (let y = y0; y <= y1; y++) set(xi, y, zi, y === y1 ? trim : stone);
    for (let y = y0 - 1; y > y0 - 60; y--) { if (get(xi, y, zi)) break; set(xi, y, zi, STONE2); }
  }

  /* roofs */
  if (roof === 'gable' || roof === 'hip') {
    const hip = roof === 'hip';
    const rad = Math.ceil(Math.hypot(hl, hw)) + 2;
    for (let k = 0; k < roofH; k++) {
      const y = y1 + 1 + k, fV = 1 - k / roofH;
      const limV = (hw + 1) * fV + 0.45, limU = (hl + 1) * fV + 0.45;
      for (let zz = -rad; zz <= rad; zz++) for (let xx = -rad; xx <= rad; xx++) {
        const x = Math.round(cx + xx), z = Math.round(cz + zz);
        if (x < 0 || x >= W || z < 0 || z >= D) continue;
        const rx = x - cx, rz = z - cz;
        const u = rx * ca + rz * sa, v = -rx * sa + rz * ca;
        const withinV = Math.abs(v) <= limV + 0.55;
        const withinU = hip ? Math.abs(u) <= limU + 0.55 : Math.abs(u) <= hl + 0.75;
        if (!withinV || !withinU) continue;
        const inV = Math.abs(v) <= limV, inU = hip ? Math.abs(u) <= limU : Math.abs(u) <= hl + 0.45;
        if (inV && inU) {
          let m = ROOF;
          if (k === 0 || k >= roofH - 1) m = ROOF2;     /* eaves & ridge */
          if (Math.abs(v) > limV - 1.25) m = ROOF2;
          if (hip && Math.abs(u) > limU - 1.25) m = ROOF2;
          set(x, y, z, m);
        } else if (!hip && Math.abs(u) > hl - 0.62 && Math.abs(v) <= hw * fV + 0.45) {
          set(x, y, z, stone);                          /* gable end wall */
        }
      }
      /* dormers riding the gable slope */
      if (!hip && o.dormers && (k === 2 || k === 3) && limV >= 0.9) {
        for (let ui = -Math.round(hl) + 2; ui <= hl - 2; ui += 4)
          for (const side of [1, -1]) {
            const [dx2, dz2] = W2(ui, side * limV);
            const xi = Math.round(dx2), zi = Math.round(dz2);
            if (hash(xi, zi, k, 23) < 0.55) {
              set(xi, y, zi, hash(xi, k, zi, 24) < 0.8 ? WIN : WINDK);
              set(xi, y + 1, zi, ROOF2);
            }
          }
      }
    }
    /* small lit round window in the gable ends */
    if (o.gableWin) {
      const gy = y1 + Math.max(2, Math.round(roofH * 0.35));
      if (gy <= y1 + roofH - 2) for (const end of [1, -1]) {
        const gx = Math.round(W2(end * hl, 0)[0]), gz = Math.round(W2(end * hl, 0)[1]);
        set(gx, gy, gz, hash(gx, gy, gz, 25) < 0.8 ? WIN : WINDK);
      }
    }
    /* copper flèche on the ridge */
    if (o.fleche) {
      const ry = y1 + roofH, fx = Math.round(cx), fz = Math.round(cz);
      for (let k = 0; k < 4; k++) set(fx, ry + k, fz, k >= 2 ? COPPER : STONE3);
      set(fx, ry + 4, fz, GOLD);
    }
    /* corner pinnacles at both gable ends */
    if (o.pinn) for (const eu of [1, -1]) for (const evv of [1, -1]) {
      const [px, pz] = W2(eu * hl, evv * hw);
      const xi = Math.round(px), zi = Math.round(pz);
      for (let k = 0; k < o.pinn; k++)
        set(xi, y1 + 1 + k, zi, k >= o.pinn - 2 ? COPPER : (k >= o.pinn - 4 ? STONE3 : STONE2));
    }
  } else if (roof === 'flat') {                          /* battlements */
    const rr2 = o.machi ? 1.45 : 0;
    for (let zz = -diag; zz <= diag; zz++) for (let xx = -diag; xx <= diag; xx++) {
      const x = Math.round(cx + xx), z = Math.round(cz + zz);
      if (x < 0 || x >= W || z < 0 || z >= D) continue;
      const rx = x - cx, rz = z - cz;
      const u = rx * ca + rz * sa, v = -rx * sa + rz * ca;
      if (Math.abs(u) > hl + rr2 + 0.49 || Math.abs(v) > hw + rr2 + 0.49) continue;
      if (o.machi) {
        if (Math.abs(u) > hl - 0.52 || Math.abs(v) > hw - 0.52) {
          set(x, y1 + 1, z, STONE2);
          if (((Math.round(u) + Math.round(v)) & 1) === 0) set(x, y1 + 2, z, STONE3);
        }
      } else if (o.crenel && ((Math.round(u) + Math.round(v)) & 1) === 0)
        set(x, y1 + 1, z, STONE3);
    }
  }
}

/* ── round tower ──────────────────────────────────────────────────── */
function roundTower(o) {
  const ox = o.x, oz = o.z, r = o.r, y0 = o.y0 ?? PLAT_Y, h = o.h ?? 12;
  const cone = o.cone ?? 0, coneH = o.coneH ?? (cone ? Math.round(2.8 * r + 3) : 0);
  const crenel = !!o.crenel, machi = !!o.machi, spire = o.spire ?? 0;
  const winN = o.winN ?? Math.round(1.4 * r), litP = o.litP ?? 0.5, dark = !!o.dark;
  const stone = o.stone ?? STONE, y1 = y0 + h - 1;
  const rr = r + 0.45, bx = Math.round(ox), bz2 = Math.round(oz);

  for (let z = Math.floor(oz - r - 2); z <= Math.ceil(oz + r + 2); z++)
    for (let x = Math.floor(ox - r - 2); x <= Math.ceil(ox + r + 2); x++) {
      if (x < 0 || x >= W || z < 0 || z >= D) continue;
      const dx = x - ox, dz = z - oz, dd = dx * dx + dz * dz;
      if (dd <= rr * rr) {
        for (let y = y0; y <= y1; y++) set(x, y, z, y < y0 + 2 ? STONE2 : stone);
        for (let y = y0 - 1; y > y0 - 72; y--) { if (get(x, y, z)) break; set(x, y, z, STONE2); }
        if (machi && dd <= (r + 1.45) * (r + 1.45) && dd > (r - 1) * (r - 1)) {
          set(x, y1 - 1, z, STONE2); set(x, y1, z, STONE2);
        }
        if (crenel && dd <= (r + 0.55) * (r + 0.55) && ((x ^ z) & 1) === 0)
          set(x, y1 + (machi ? 2 : 1), z, STONE3);
      }
    }
  /* slit windows by angle segments */
  for (let wi = 0; wi < winN; wi++) {
    const th = (wi + 0.5) * Math.PI * 2 / winN;
    const wx = Math.round(ox + Math.cos(th) * (r + 0.2));
    const wz = Math.round(oz + Math.sin(th) * (r + 0.2));
    for (let fy = y0 + 3; fy + 1 <= y1 - 1; fy += 7)
      for (let k = 0; k < 2; k++)
        set(wx, fy + k, wz, dark ? WINDK : (hash(wx, fy + k, wz, 13) < litP * 0.72 ? WIN : WINDK));
  }
  /* stepped cone roof */
  if (cone) {
    const R0 = r + (crenel ? -0.6 : 1.2);
    for (let k = 0; k < coneH; k++) {
      const y = y1 + 1 + k, rad = R0 * Math.pow(1 - k / coneH, 1.08);
      if (rad < 0.4) break;
      const ri = Math.ceil(rad);
      for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++) {
        const dd = Math.hypot(dx, dz);
        if (dd <= rad + 0.3)
          set(bx + dx, y, bz2 + dz, (k === 0 || dd > rad - 1.15) ? ROOF2 : ROOF);
      }
      if (k % 6 === 2 && !dark) for (let dI = 0; dI < 8; dI++) {
        const th = dI * Math.PI / 4 + k * 0.3;
        const dx2 = Math.round(ox + Math.cos(th) * rad * 0.75);
        const dz2 = Math.round(oz + Math.sin(th) * rad * 0.75);
        if (hash(dx2, dz2, k, 33) < 0.5) { set(dx2, y, dz2, WIN); set(dx2, y + 1, dz2, ROOF2); }
      }
    }
    if (spire) for (let k = 0; k < spire; k++)
      set(bx, y1 + coneH + k, bz2, k >= spire - 2 ? COPPER : STONE3);
  }
}

/* ── square tower: hall + hip roof + optional corner pinnacles ────── */
function squareTower(o) {
  const s = o.s ?? 3;
  hall({
    cx: o.cx, cz: o.cz, ang: o.ang ?? 0, hl: s, hw: s, y0: o.y0, h: o.h,
    roof: 'hip', roofH: o.roofH ?? Math.round(2.6 * s + 4), win: o.win ?? 'normal',
    ev: o.ev ?? 3, crenel: o.crenel, machi: o.machi, buttress: o.buttress,
    litP: o.litP, floorH: o.floorH ?? 9
  });
  if (o.pinn) for (const [su, sv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const [px, pz] = toWorld2(o.cx, o.cz, o.ang ?? 0, su * s, sv * s);
    const xi = Math.round(px), zi = Math.round(pz), yT = (o.y0 ?? PLAT_Y) + o.h;
    for (let k = 0; k < o.pinn; k++)
      set(xi, yT + k, zi, k >= o.pinn - 2 ? COPPER : (k < 2 ? STONE3 : STONE2));
  }
}

/* ── bridges ──────────────────────────────────────────────────────── */
function bridge(o) {
  const x0 = o.x0, z0 = o.z0, x1 = o.x1, z1 = o.z1, y = o.y ?? PLAT_Y;
  const wood = !!o.wood, truss = !!o.truss, cover = !!o.cover;
  const deckM = wood ? WOOD2 : STONE3, railM = wood ? WOOD : STONE2;
  const dx = x1 - x0, dz = z1 - z0, n = Math.max(1, Math.ceil(Math.hypot(dx, dz)));
  const ux = dx / n, uz = dz / n, pwx = -uz, pwz = ux;
  for (let i = 0; i <= n; i++) {
    const bx = x0 + ux * i, bz = z0 + uz * i, xi = Math.round(bx), zi = Math.round(bz);
    for (let j = -1; j <= 1; j++) {
      set(Math.round(bx + pwx * j), y, Math.round(bz + pwz * j), deckM);
      if (j !== 0 && i % 8 !== 2)
        set(Math.round(bx + pwx * j), y + 1, Math.round(bz + pwz * j), railM);
    }
    /* lantern posts */
    if (o.lantEvery && i % o.lantEvery === 2) {
      const lx = Math.round(bx + pwx * 1.5), lz = Math.round(bz + pwz * 1.5);
      set(lx, y + 2, lz, IRON); set(lx, y + 3, lz, LANT);
    }
    /* stone piers every pierEvery + shallow arch masonry */
    if (!wood && o.pierEvery) {
      if (i % o.pierEvery === 0)
        for (const j of [-1, 0, 1])
          dropFill(Math.round(bx + pwx * j), Math.round(bz + pwz * j), y - 1, STONE2, 90);
      set(xi, y - 1, zi, STONE2);                            /* spandrel band */
      if (i % o.pierEvery === 1) set(xi, y - 2, zi, STONE2); /* arch curve */
    }
    /* wooden trestle posts + diagonal lattice */
    if (wood && truss && i % 3 === 0)
      for (const j of [-1, 1])
        dropFill(Math.round(bx + pwx * j), Math.round(bz + pwz * j), y - 1, WOOD, 60);
    if (wood && truss && i % 6 === 3)
      for (const j of [-1, 1]) {
        const ax = bx + pwx * j - ux * 3, az = bz + pwz * j - uz * 3;
        lineV(Math.round(ax), y - 1, Math.round(az), xi, y - 3, zi, WOOD, 0);
      }
    /* covered gable roof */
    if (cover) {
      for (let j = -1; j <= 1; j++) set(Math.round(bx + pwx * j), y + 2, Math.round(bz + pwz * j), ROOF2);
      set(xi, y + 3, zi, ROOF2);
    }
  }
}

/* ── lantern stairway following a plan-pixel polyline ─────────────── */
function stairPath(pts, yA, yB, w = 3, lantEvery = 5) {
  const P = pts.map(p => [PF(p[0]), QZ(p[1])]);
  let total = 0;
  for (let s = 0; s < P.length - 1; s++)
    total += Math.hypot(P[s + 1][0] - P[s][0], P[s + 1][1] - P[s][1]);
  if (total < 1) return;
  let acc = 0, step = 0;
  for (let s = 0; s < P.length - 1; s++) {
    const xa = P[s][0], za = P[s][1], xb = P[s + 1][0], zb = P[s + 1][1];
    const segLen = Math.hypot(xb - xa, zb - za), nSeg = Math.max(1, Math.ceil(segLen));
    const dxu = (xb - xa) / segLen, dzu = (zb - za) / segLen;
    const px2 = -dzu, pz2 = dxu;
    for (let i = s === 0 ? 0 : 1; i <= nSeg; i++) {
      const bx = lerp(xa, xb, i / nSeg), bz = lerp(za, zb, i / nSeg);
      const y = Math.round(lerp(yA, yB, clamp(acc / total, 0, 1)));
      acc += segLen / nSeg; step++;
      /* deck */
      for (let j = -1; j <= 1; j++)
        set(Math.round(bx + px2 * j), y, Math.round(bz + pz2 * j),
            (step + 10) % 5 === 0 ? STONE2 : STONE3);
      /* side parapets */
      for (const j of [-2, 2]) {
        const xi = Math.round(bx + px2 * j), zi = Math.round(bz + pz2 * j);
        set(xi, y, zi, STONE2);
        set(xi, y + 1, zi, (step + (j > 0 ? 0 : 1)) % 2 === 0 ? STONE3 : STONE2);
      }
      /* 5-voxel headroom carve */
      for (let j = -1; j <= 1; j++)
        for (let k = 1; k <= 5; k++) {
          const xi = Math.round(bx + px2 * j), zi = Math.round(bz + pz2 * j);
          if (surfY(xi, zi) > y + k) set(xi, y + k, zi, 0);
        }
      /* pier supports down to ground / lake bed */
      if (step % 3 === 0)
        for (const j of [-1, 1])
          dropFill(Math.round(bx + px2 * j), Math.round(bz + pz2 * j), y - 1, STONE2, 90, true);
      /* lantern posts */
      if (step % lantEvery === 0) {
        const xi = Math.round(bx + px2 * 2), zi = Math.round(bz + pz2 * 2);
        set(xi, y + 2, zi, IRON); set(xi, y + 3, zi, LANT);
      }
    }
  }
}
