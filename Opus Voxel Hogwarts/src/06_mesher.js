
// ============================================================================
// 9. MESHER — culled faces, per-vertex ambient occlusion, per-voxel colour grain
// ============================================================================
const NPAL = PAL.length;
const KIND = new Uint8Array(256), OPQ = new Uint8Array(256), VARY = new Float32Array(256), LIN = new Float32Array(256 * 3);
for (let i = 1; i < NPAL; i++) {
  const p = PAL[i], c = new THREE.Color(p.hex);            // converts sRGB hex -> linear working space
  KIND[i] = p.kind; OPQ[i] = p.kind <= 2 ? 1 : 0; VARY[i] = p.vary;
  LIN[i * 3] = c.r; LIN[i * 3 + 1] = c.g; LIN[i * 3 + 2] = c.b;
}
const opq = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) ? 0 : OPQ[grid[I(x, y, z)]];

// normal, u axis, v axis with u × v = n  (corners: o, o+u, o+u+v, o+v are CCW seen from outside)
const FACES = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] }, { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] }, { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] },
].map(f => ({ ...f, o: f.n.map(c => c > 0 ? 1 : 0) }));
const AO_CURVE = [0.42, 0.62, 0.8, 1.0];

class GeoBuf {
  constructor() { this.cap = 8192; this.alloc(); this.n = 0; }
  alloc() {
    const c = this.cap, old = this.pos && { pos: this.pos, nor: this.nor, col: this.col, idx: this.idx };
    this.pos = new Int16Array(c * 12); this.nor = new Int8Array(c * 12); this.col = new Uint16Array(c * 12); this.idx = new Uint32Array(c * 6);
    if (old) { this.pos.set(old.pos); this.nor.set(old.nor); this.col.set(old.col); this.idx.set(old.idx); }
  }
  quad(p, nrm, cols, flip) {
    if (this.n >= this.cap) { this.cap *= 2; this.alloc(); }
    const q = this.n++, b = q * 12, vb = q * 4;
    for (let i = 0; i < 12; i++) { this.pos[b + i] = p[i]; this.nor[b + i] = nrm[i % 3] * 127; this.col[b + i] = cols[i]; }
    const ib = q * 6;
    if (flip) { this.idx.set([vb, vb + 1, vb + 3, vb + 1, vb + 2, vb + 3], ib); }
    else { this.idx.set([vb, vb + 1, vb + 2, vb, vb + 2, vb + 3], ib); }
  }
  geometry() {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry(), v = this.n * 4;
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0, v * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.slice(0, v * 3), 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.slice(0, v * 3), 3, true));
    g.setIndex(new THREE.BufferAttribute(this.idx.slice(0, this.n * 6), 1));
    g.computeBoundingSphere();
    this.n = 0;
    return g;
  }
}

const CS = 48;
// kind buckets: 1 solid, 2 emissive, 3 water, 4 glass
function meshChunk(cx0, cy0, cz0, bufs) {
  const P = new Array(12), C = new Array(12), ao = [0, 0, 0, 0];
  for (let y = cy0; y < Math.min(H, cy0 + CS); y++) for (let z = cz0; z < Math.min(D, cz0 + CS); z++) for (let x = cx0; x < Math.min(W, cx0 + CS); x++) {
    const m = grid[I(x, y, z)]; if (!m) continue;
    const k = KIND[m];
    const g = 1 + (hash(x, y, z) - 0.5) * 2 * VARY[m];
    const br = LIN[m * 3] * g, bg = LIN[m * 3 + 1] * g, bb = LIN[m * 3 + 2] * g;
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
      const nm = (nx < 0 || ny < 0 || nz < 0 || nx >= W || ny >= H || nz >= D) ? 0 : grid[I(nx, ny, nz)];
      const nk = KIND[nm];
      if (k <= 2) { if (nk === 1 || nk === 2) continue; }
      else if (k === 3) { if (nm !== 0 && nk !== 4) continue; }
      else if (k === 4) { if (nk !== 0 && nk !== 3) continue; }
      const U = F.u, V = F.v;
      for (let c = 0; c < 4; c++) {
        const cu = (c === 1 || c === 2) ? 1 : 0, cv = (c >= 2) ? 1 : 0;
        P[c * 3] = x + F.o[0] + U[0] * cu + V[0] * cv;
        P[c * 3 + 1] = y + F.o[1] + U[1] * cu + V[1] * cv;
        P[c * 3 + 2] = z + F.o[2] + U[2] * cu + V[2] * cv;
        let a = 3;
        if (k <= 2) {
          const su = cu ? 1 : -1, sv = cv ? 1 : -1;
          const s1 = opq(nx + U[0] * su, ny + U[1] * su, nz + U[2] * su);
          const s2 = opq(nx + V[0] * sv, ny + V[1] * sv, nz + V[2] * sv);
          const cc = opq(nx + U[0] * su + V[0] * sv, ny + U[1] * su + V[1] * sv, nz + U[2] * su + V[2] * sv);
          a = (s1 && s2) ? 0 : 3 - (s1 + s2 + cc);
          if (k === 2) a = Math.max(a, 2);
        }
        ao[c] = a;
        const l = AO_CURVE[a] * 65535;
        C[c * 3] = Math.min(65535, br * l); C[c * 3 + 1] = Math.min(65535, bg * l); C[c * 3 + 2] = Math.min(65535, bb * l);
      }
      bufs[k].quad(P, F.n, C, ao[0] + ao[2] < ao[1] + ao[3]);
    }
  }
}
