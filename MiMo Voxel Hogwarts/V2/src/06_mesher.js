/* ============================================================
   06_mesher.js — voxel → triangle mesher (PROJECT.md §10)
   48³ chunks · face culling · voxel ambient occlusion ·
   colour grain · compact Int16/Int8/Uint16/Uint32 buffers
   ============================================================ */

const CHUNK = 48;
const NXc = Math.ceil(W / CHUNK), NYc = Math.ceil(H / CHUNK), NZc = Math.ceil(D / CHUNK);

// face table: normal n, axes u/v with u × v = n; o = face-plane origin corner
const FACES = [
  { n: [1, 0, 0],  u: [0, 1, 0], v: [0, 0, 1], o: [1, 0, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], o: [0, 0, 0] },
  { n: [0, 1, 0],  u: [0, 0, 1], v: [1, 0, 0], o: [0, 1, 0] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], o: [0, 0, 0] },
  { n: [0, 0, 1],  u: [1, 0, 0], v: [0, 1, 0], o: [0, 0, 1] },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], o: [0, 0, 0] }
];
const AO_LUT = [0.42, 0.62, 0.80, 1.0];

function faceVisible(kind, nid) {
  if (nid === 0) return true;
  const nk = M_KIND[nid];
  if (kind <= 2) return nk >= 3;          // opaque vs air/water/glass
  if (kind === 3) return nk === 0 || nk === 4;   // water vs air/glass
  return nk === 0 || nk === 3;                  // glass vs air/water
}

// growable per-kind buffers (reset between chunks)
function makeBuf() {
  return {
    p: new Int16Array(12288 * 3), n: new Int8Array(12288 * 3),
    c: new Uint16Array(12288 * 3), i: new Uint32Array(18432 * 3),
    vn: 0, in: 0,
    reset() { this.vn = 0; this.in = 0; },
    growV() {
      const p = new Int16Array(this.p.length * 2); p.set(this.p); this.p = p;
      const n = new Int8Array(this.n.length * 2); n.set(this.n); this.n = n;
      const c = new Uint16Array(this.c.length * 2); c.set(this.c); this.c = c;
    },
    growI() {
      const i = new Uint32Array(this.i.length * 2); i.set(this.i); this.i = i;
    },
    vert(x, y, z, nx, ny, nz, r, g, b) {
      if ((this.vn + 1) * 3 > this.p.length) this.growV();
      const v3 = this.vn * 3;
      this.p[v3] = x; this.p[v3 + 1] = y; this.p[v3 + 2] = z;
      this.n[v3] = nx; this.n[v3 + 1] = ny; this.n[v3 + 2] = nz;
      this.c[v3] = r; this.c[v3 + 1] = g; this.c[v3 + 2] = b;
      this.vn++;
    },
    tri(a, b, c) {
      if (this.in + 3 > this.i.length) this.growI();
      this.i[this.in] = a; this.i[this.in + 1] = b; this.i[this.in + 2] = c;
      this.in += 3;
    }
  };
}
const BUFS = [makeBuf(), makeBuf(), makeBuf(), makeBuf()];

function geomFrom(b) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(b.p.slice(0, b.vn * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(b.n.slice(0, b.vn * 3), 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(b.c.slice(0, b.vn * 3), 3, true));
  g.setIndex(new THREE.BufferAttribute(b.i.slice(0, b.in), 1));
  g.computeBoundingSphere();
  return g;
}

// meshes every chunk into `group` (materials: solid, emissive, water, glass)
async function addChunkMeshes(group, mats, onProgress) {
  let totalTris = 0, meshes = 0;
  let chunkNo = 0;
  const nChunks = NXc * NYc * NZc;

  for (let cy = 0; cy < NYc; cy++)
    for (let cz = 0; cz < NZc; cz++)
      for (let cx = 0; cx < NXc; cx++) {
        const x0 = cx * CHUNK, x1 = Math.min(W, x0 + CHUNK);
        const y0 = cy * CHUNK, y1 = Math.min(H, y0 + CHUNK);
        const z0 = cz * CHUNK, z1 = Math.min(D, z0 + CHUNK);
        for (const b of BUFS) b.reset();

        for (let y = y0; y < y1; y++) {
          const yOff = D * y;
          for (let z = z0; z < z1; z++) {
            const row = W * (z + yOff);
            for (let x = x0; x < x1; x++) {
              const m = grid[x + row];
              if (m === 0) continue;
              const kind = M_KIND[m];
              if (kind === 0) continue;
              const bi = kind === 1 ? 0 : kind === 2 ? 1 : kind === 3 ? 2 : 3;
              const b = BUFS[bi];
              const grain = 1 + (hash(x, y, z) - 0.5) * 2 * M_VARY[m];
              const br = M_R[m] * grain, bg = M_G[m] * grain, bb = M_B[m] * grain;
              const opaque = kind <= 2;

              for (let f = 0; f < 6; f++) {
                const F = FACES[f];
                const nx2 = x + F.n[0], ny2 = y + F.n[1], nz2 = z + F.n[2];
                let nid;
                if (nx2 < 0 || nx2 >= W || ny2 < 0 || ny2 >= H || nz2 < 0 || nz2 >= D) nid = 0;
                else nid = grid[nx2 + W * (nz2 + D * ny2)];
                if (!faceVisible(kind, nid)) continue;

                // voxel AO on the 4 corners (opaque only)
                let a0 = 3, a1 = 3, a2 = 3, a3 = 3;
                if (opaque) {
                  const ux = F.u[0], uy = F.u[1], uz = F.u[2];
                  const vx = F.v[0], vy = F.v[1], vz = F.v[2];
                  let s1, s2, cc;
                  s1 = M_OPAQUE[get(nx2 - ux, ny2 - uy, nz2 - uz)];
                  s2 = M_OPAQUE[get(nx2 - vx, ny2 - vy, nz2 - vz)];
                  cc = M_OPAQUE[get(nx2 - ux - vx, ny2 - uy - vy, nz2 - uz - vz)];
                  a0 = (s1 && s2) ? 0 : 3 - (s1 + s2 + cc);
                  s1 = M_OPAQUE[get(nx2 + ux, ny2 + uy, nz2 + uz)];
                  cc = M_OPAQUE[get(nx2 + ux - vx, ny2 + uy - vy, nz2 + uz - vz)];
                  a1 = (s1 && s2) ? 0 : 3 - (s1 + s2 + cc);
                  s2 = M_OPAQUE[get(nx2 + vx, ny2 + vy, nz2 + vz)];
                  cc = M_OPAQUE[get(nx2 + ux + vx, ny2 + uy + vy, nz2 + uz + vz)];
                  a2 = (s1 && s2) ? 0 : 3 - (s1 + s2 + cc);
                  s1 = M_OPAQUE[get(nx2 - ux, ny2 - uy, nz2 - uz)];
                  cc = M_OPAQUE[get(nx2 - ux + vx, ny2 - uy + vy, nz2 - uz + vz)];
                  a3 = (s1 && s2) ? 0 : 3 - (s1 + s2 + cc);
                  if (kind === 2) {                            // emissive: clamp ≥ level 2
                    if (a0 < 2) a0 = 2; if (a1 < 2) a1 = 2;
                    if (a2 < 2) a2 = 2; if (a3 < 2) a3 = 2;
                  }
                }
                const l0 = AO_LUT[a0], l1 = AO_LUT[a1], l2 = AO_LUT[a2], l3 = AO_LUT[a3];

                const x0v = x + F.o[0], y0v = y + F.o[1], z0v = z + F.o[2];
                const ux2 = F.u[0], uy2 = F.u[1], uz2 = F.u[2];
                const vx2 = F.v[0], vy2 = F.v[1], vz2 = F.v[2];
                const n8x = F.n[0] * 127, n8y = F.n[1] * 127, n8z = F.n[2] * 127;
                const vBase = b.vn;
                let cr = br * l0; let cg = bg * l0; let cb = bb * l0;
                b.vert(x0v, y0v, z0v, n8x, n8y, n8z,
                  cr > 1 ? 65535 : (cr * 65535) | 0, cg > 1 ? 65535 : (cg * 65535) | 0, cb > 1 ? 65535 : (cb * 65535) | 0);
                cr = br * l1; cg = bg * l1; cb = bb * l1;
                b.vert(x0v + ux2, y0v + uy2, z0v + uz2, n8x, n8y, n8z,
                  cr > 1 ? 65535 : (cr * 65535) | 0, cg > 1 ? 65535 : (cg * 65535) | 0, cb > 1 ? 65535 : (cb * 65535) | 0);
                cr = br * l2; cg = bg * l2; cb = bb * l2;
                b.vert(x0v + ux2 + vx2, y0v + uy2 + vy2, z0v + uz2 + vz2, n8x, n8y, n8z,
                  cr > 1 ? 65535 : (cr * 65535) | 0, cg > 1 ? 65535 : (cg * 65535) | 0, cb > 1 ? 65535 : (cb * 65535) | 0);
                cr = br * l3; cg = bg * l3; cb = bb * l3;
                b.vert(x0v + vx2, y0v + vy2, z0v + vz2, n8x, n8y, n8z,
                  cr > 1 ? 65535 : (cr * 65535) | 0, cg > 1 ? 65535 : (cg * 65535) | 0, cb > 1 ? 65535 : (cb * 65535) | 0);
                if (a0 + a2 < a1 + a3) {                      // flip diagonal
                  b.tri(vBase + 1, vBase + 2, vBase + 3);
                  b.tri(vBase + 1, vBase + 3, vBase);
                } else {
                  b.tri(vBase, vBase + 1, vBase + 2);
                  b.tri(vBase, vBase + 2, vBase + 3);
                }
              }
            }
          }
        }

        for (let k = 0; k < 4; k++) {
          const b = BUFS[k];
          if (b.vn === 0) continue;
          const mesh = new THREE.Mesh(geomFrom(b), mats[k]);
          if (k <= 1) { mesh.castShadow = true; mesh.receiveShadow = true; }
          else if (k === 2) mesh.receiveShadow = true;
          group.add(mesh);
          meshes++;
          totalTris += b.in / 3;
        }
        chunkNo++;
        if (onProgress && (chunkNo & 7) === 0) {
          onProgress(chunkNo / nChunks);
          await new Promise(r => setTimeout(r, 0));            // yield so the loader updates
        }
      }
  if (onProgress) onProgress(1);
  return { tris: totalTris, meshes };
}