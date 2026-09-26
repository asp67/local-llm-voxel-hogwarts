/* ════════════════════════════════════════════════════════════════════
   06_mesher.js — voxel → triangle mesher
   48³ chunks, face culling, voxel AO, colour grain, compact buffers.
   Also: meshCells() for cloud/moon blobs and miniMesh() for the car.
   ════════════════════════════════════════════════════════════════════ */

const CH = 48, NXC = W / CH, NYCH = Math.ceil(H / CH), NZC = D / CH;

/* face table: normal n, axes u, v with u × v = n; corners CCW from outside */
const FACES = [
  { n: [1, 0, 0],  u: [0, 1, 0], v: [0, 0, 1] },   /* +x */
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },   /* -x */
  { n: [0, 1, 0],  u: [0, 0, 1], v: [1, 0, 0] },   /* +y */
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },   /* -y */
  { n: [0, 0, 1],  u: [1, 0, 0], v: [0, 1, 0] },   /* +z */
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] }    /* -z */
];
const FBASE = [[1, 0, 0], [0, 0, 0], [0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 0, 0]];
const AOF = [0.55, 0.68, 0.84, 1.0];
const CORN = [[0, 0], [1, 0], [1, 1], [0, 1]];

/* precomputed per face / corner offsets: corner position and AO samples */
const CPOS = [], AOS = [];
for (let f = 0; f < 6; f++) {
  const F = FACES[f];
  const b0 = [[1, 0, 0], [0, 0, 0], [0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 0, 0]][f];
  CPOS.push(CORN.map(([a, c]) => [
    b0[0] + a * F.u[0] + c * F.v[0],
    b0[1] + a * F.u[1] + c * F.v[1],
    b0[2] + a * F.u[2] + c * F.v[2]
  ]));
  AOS.push(CORN.map(([a, c]) => {
    const m1 = a ? 1 : -1, m2 = c ? 1 : -1;
    const du = [m1 * F.u[0], m1 * F.u[1], m1 * F.u[2]];
    const dv = [m2 * F.v[0], m2 * F.v[1], m2 * F.v[2]];
    return [du, dv, [du[0] + dv[0], du[1] + dv[1], du[2] + dv[2]]];
  }));
}

const MAXV = 340000;                     /* scratch vertex capacity per chunk */
const sPos = new Int16Array(MAXV * 3);
const sNor = new Int8Array(MAXV * 3);
const sCol = new Uint16Array(MAXV * 3);
const sIdx = new Uint32Array(MAXV / 4 * 6);
let facesDropped = 0;                    /* faces skipped when a chunk overflows */

const OPA = m => m !== 0 && KIND[m] < 3;              /* opaque test */

/* first pass: count visible faces per material slot — needed to give each
   slot a disjoint region of the shared scratch buffers (all four counters
   previously started at 0 and overwrote each other's faces in mixed chunks) */
function countChunkFaces(x0, y0, z0, yEnd, xL, zL) {
  const cnt = [0, 0, 0, 0];
  for (let y = y0; y < yEnd; y++)
    for (let z = z0; z < z0 + zL; z++)
      for (let x = x0; x < x0 + xL; x++) {
        const m = grid[I(x, y, z)];
        if (!m) continue;
        const kind = KIND[m];
        for (let f = 0; f < 6; f++) {
          const n = FACES[f].n;
          const nb = get(x + n[0], y + n[1], z + n[2]);
          if (kind === 3) { if (nb !== 0 && KIND[nb] !== 4) continue; }
          else if (kind === 4) { if (nb !== 0 && KIND[nb] !== 3) continue; }
          else if (OPA(nb)) continue;
          cnt[kind - 1]++;
        }
      }
  return cnt;
}

/* build chunk quad soup into the scratch buffers → four slot objects */
function meshChunk(x0, y0, z0, xL, yL, zL) {
  const z0e = y0 + yL > H ? H : y0 + yL;
  const cnt = countChunkFaces(x0, y0, z0, z0e, xL, zL);
  const s0 = { v: 0, i: 0, b: 0, ib: 0, drop: 0 }, s1 = { v: 0, i: 0, b: 0, ib: 0, drop: 0 };
  const s2 = { v: 0, i: 0, b: 0, ib: 0, drop: 0 }, s3 = { v: 0, i: 0, b: 0, ib: 0, drop: 0 };
  const slots = [s0, s1, s2, s3];
  let totV = 0, totI = 0;
  for (let k = 0; k < 4; k++) {
    slots[k].b = totV; slots[k].ib = totI;
    totV += cnt[k] * 4; totI += cnt[k] * 6;
  }
  if (totV > MAXV) {                        /* whole-chunk overflow: drop all */
    facesDropped += cnt[0] + cnt[1] + cnt[2] + cnt[3];
    return slots;
  }
  for (let y = y0; y < z0e; y++)
    for (let z = z0; z < z0 + zL; z++)
      for (let x = x0; x < x0 + xL; x++) {
        const m = grid[I(x, y, z)];
        if (!m) continue;
        const kind = KIND[m];                /* 1 solid · 2 emissive · 3 water · 4 glass */
        let S, isOpq, isLiq, isGlass;
        if (kind === 1) { S = s0; isOpq = true; isLiq = false; isGlass = false; }
        else if (kind === 2) { S = s1; isOpq = true; isLiq = false; isGlass = false; }
        else if (kind === 3) { S = s2; isOpq = false; isLiq = true; isGlass = false; }
        else { S = s3; isOpq = false; isLiq = false; isGlass = true; }

        for (let f = 0; f < 6; f++) {
          const F = FACES[f], n = F.n;
          const nx = x + n[0], ny = y + n[1], nz = z + n[2];
          const nb = get(nx, ny, nz);
          if (isOpq) { if (OPA(nb)) continue; }
          else if (isLiq) { if (nb !== 0 && KIND[nb] !== 4) continue; }
          else { if (nb !== 0 && KIND[nb] !== 3) continue; }

          const lv = S.v;                    /* local vertex id inside the slot */
          if (S.b + lv + 4 > MAXV) { S.drop = (S.drop || 0) + 1; continue; }
          const g = 1 + (hash(x, y, z, 5) - 0.5) * 2 * VARY[m];
          const cr = CCH[m * 3], cg = CCH[m * 3 + 1], cb = CCH[m * 3 + 2];
          const cps = CPOS[f], aos = AOS[f];
          const ao = [3, 3, 3, 3];
          if (isOpq) {
            for (let ci = 0; ci < 4; ci++) {
              const [du, dv, dbc] = aos[ci];
              const o1 = get(x + n[0] + du[0], y + n[1] + du[1], z + n[2] + du[2]);
              const s1 = OPA(o1);
              const o2 = get(x + n[0] + dv[0], y + n[1] + dv[1], z + n[2] + dv[2]);
              const s2 = OPA(o2);
              if (s1 && s2) { ao[ci] = 0; continue; }
              const oc = get(x + n[0] + dbc[0], y + n[1] + dbc[1], z + n[2] + dbc[2]);
              const sl = OPA(oc) ? 1 : 0;
              ao[ci] = 3 - ((s1 ? 1 : 0) + (s2 ? 1 : 0) + sl);
            }
          }
          for (let ci = 0; ci < 4; ci++) {
            const vi = (S.b + lv + ci) * 3, cp = cps[ci];
            sPos[vi] = x + cp[0]; sPos[vi + 1] = y + cp[1]; sPos[vi + 2] = z + cp[2];
            sNor[vi] = n[0] * 127; sNor[vi + 1] = n[1] * 127; sNor[vi + 2] = n[2] * 127;
            let aoV = ao ? ao[ci] : 3;
            if (kind === 2 && aoV < 2) aoV = 2;      /* emissive glow clamp */
            const aa = AOF[aoV] * g;
            sCol[vi] = (cr * aa > 1 ? 1 : cr * aa) * 65535;
            sCol[vi + 1] = (cg * aa > 1 ? 1 : cg * aa) * 65535;
            sCol[vi + 2] = (cb * aa > 1 ? 1 : cb * aa) * 65535;
          }
          const bi = S.ib + S.i, flip = (ao[0] + ao[2]) < (ao[1] + ao[3]);
          if (!flip) {
            sIdx[bi] = lv; sIdx[bi + 1] = lv + 1; sIdx[bi + 2] = lv + 2;
            sIdx[bi + 3] = lv; sIdx[bi + 4] = lv + 2; sIdx[bi + 5] = lv + 3;
          } else {
            sIdx[bi] = lv + 1; sIdx[bi + 1] = lv + 2; sIdx[bi + 2] = lv + 3;
            sIdx[bi + 3] = lv + 1; sIdx[bi + 4] = lv + 3; sIdx[bi + 5] = lv;
          }
          S.v += 4; S.i += 6;
        }
      }
  facesDropped += s0.drop + s1.drop + s2.drop + s3.drop;
  return [s0, s1, s2, s3];
}

/* build chunk meshes into the scene; returns triangle count */
async function buildChunkMeshes(scene, progress, yieldFn) {
  let tris = 0;
  const make = (o, matr, cast, recv) => {
    if (o.v === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(sPos.slice(o.b * 3, (o.b + o.v) * 3), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(sNor.slice(o.b * 3, (o.b + o.v) * 3), 3, true));
    geometry.setAttribute('color', new THREE.BufferAttribute(sCol.slice(o.b * 3, (o.b + o.v) * 3), 3, true));
    geometry.setIndex(new THREE.BufferAttribute(sIdx.slice(o.ib, o.ib + o.i), 1));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, matr);
    mesh.castShadow = cast; mesh.receiveShadow = recv;
    if (matr.transparent) mesh.renderOrder = 2;
    scene.add(mesh);
    tris += o.i / 3;
  };
  for (let cy = 0; cy < NYCH; cy++)
    for (let cx2 = 0; cx2 < NXC; cx2++)
      for (let cz = 0; cz < NZC; cz++) {
        const r = meshChunk(cx2 * CH, cy * CH, cz * CH, CH, Math.min(CH, H - cy * CH), CH);
        make(r[0], MATS.solid, true, true);
        make(r[1], MATS.emis, true, false);
        make(r[2], MATS.water, false, false);
        make(r[3], MATS.glass, false, true);
        progress();
        await yieldFn();
      }
  return tris;
}

/* small voxel-map mesher (clouds, moon): cells = Set("x,y,z") at `cell` size */
function meshCells(cells, cell, color) {
  const has = (x, y, z) => cells.has(x + ',' + y + ',' + z);
  const pos = [], nor = [], col = [], idx = [];
  for (const key of cells) {
    const xyz = key.split(',').map(Number), x = xyz[0], y = xyz[1], z = xyz[2];
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], n = F.n;
      const FB = [[1, 0, 0], [0, 0, 0], [0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 0, 0]][f];
      if (has(x + n[0], y + n[1], z + n[2])) continue;
      const vb = pos.length / 3;
      for (const [a, c] of CORN) {
        pos.push((x + FB[0] + a * F.u[0] + c * F.v[0]) * cell,
                 (y + FB[1] + a * F.u[1] + c * F.v[1]) * cell,
                 (z + FB[2] + a * F.u[2] + c * F.v[2]) * cell);
        nor.push(n[0], n[1], n[2]);
        col.push(color[0], color[1], color[2]);
      }
      idx.push(vb, vb + 1, vb + 2, vb, vb + 2, vb + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geometry.setIndex(idx);
  return geometry;
}

/* merged axis-aligned boxes for mini models: [{x,y,z,sx,sy,sz,hex,glow,lum}] */
function miniMesh(parts) {
  const solid = { pos: [], nor: [], col: [], idx: [] };
  const glow = { pos: [], nor: [], col: [], idx: [] };
  const cTmp = new THREE.Color();
  for (const p of parts) {
    const t = p.glow ? glow : solid;
    cTmp.set(p.hex);
    if (p.lum) cTmp.multiplyScalar(p.lum);
    const x0 = p.x - p.sx / 2, y0 = p.y - p.sy / 2, z0 = p.z - p.sz / 2;
    const x1 = p.x + p.sx / 2, y1 = p.y + p.sy / 2, z1 = p.z + p.sz / 2;
    const PTS = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
                 [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    /* box quads as [i0,i1,i2,i3, nx,ny,nz] */
    const QF = [[4, 5, 6, 7, 0, 0, 1], [1, 0, 3, 2, 0, 0, -1], [5, 1, 2, 6, 0, 1, 0],
                [0, 4, 7, 3, 0, -1, 0], [3, 7, 6, 2, 1, 0, 0], [0, 1, 5, 4, -1, 0, 0]];
    for (const q of QF) {
      const vb = t.pos.length / 3;
      for (let oi = 0; oi < 4; oi++) {
        const P = PTS[q[oi]];
        t.pos.push(P[0], P[1], P[2]);
        t.nor.push(q[4], q[5], q[6]);
        t.col.push(cTmp.r, cTmp.g, cTmp.b);
      }
      t.idx.push(vb, vb + 1, vb + 2, vb, vb + 2, vb + 3);
    }
  }
  const mk = t => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(t.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(t.col, 3));
    g.setIndex(t.idx);
    return g;
  };
  return { solid: mk(solid), glow: mk(glow) };
}
