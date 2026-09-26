/* ============================================================
   07_scene.js — renderer, sky, lights, materials, clouds,
   stars, moon, flying car, bloom  (PROJECT.md §11)
   ============================================================ */

let renderer, scene, camPersp, camOrtho, composer, renderPass;
let voxelGroup;
const cloudGroup = new THREE.Group();
const cloudList = [];
let moonMesh, stars;
const pointLights = [];

// ---- materials (kind 1..4) ----
const MAT_SOLID = new THREE.MeshLambertMaterial({ vertexColors: true });
const MAT_EMISSIVE = new THREE.MeshBasicMaterial({
  vertexColors: true, color: new THREE.Color(1.9, 1.9, 1.9)
});
const MAT_WATER = new THREE.MeshPhongMaterial({
  vertexColors: true, color: 0xffffff, opacity: 0.8, transparent: true,
  shininess: 90, specular: new THREE.Color(0x5c74b8), depthWrite: false
});
const MAT_GLASS = new THREE.MeshPhongMaterial({
  vertexColors: true, opacity: 0.5, transparent: true, shininess: 60,
  specular: new THREE.Color(0x9fd8c8), emissive: new THREE.Color(0x16352c),
  depthWrite: false
});

// ---- moon direction: 8° above horizon, 45° left of the default view ----
const MOON_EL = 8 * DEG;
const MOON_AZ = 0.62 + Math.PI + Math.PI / 4;
const MOON_SKY = new THREE.Vector3(
  Math.sin(MOON_AZ) * Math.cos(MOON_EL),
  Math.sin(MOON_EL),
  Math.cos(MOON_AZ) * Math.cos(MOON_EL)
);
let moonLight;

function initScene() {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  // vertical night gradient sky
  const bg = document.createElement('canvas');
  bg.width = 2; bg.height = 256;
  const bctx = bg.getContext('2d');
  const grad = bctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#050817');
  grad.addColorStop(0.38, '#0b1336');
  grad.addColorStop(0.72, '#15215a');
  grad.addColorStop(1.0, '#1c2a6a');
  bctx.fillStyle = grad;
  bctx.fillRect(0, 0, 2, 256);
  const bgTex = new THREE.CanvasTexture(bg);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTex;

  camPersp = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 4000);
  camOrtho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(0x5a6cc0, 0x1a1522, 1.1));
  scene.add(new THREE.AmbientLight(0x202848, 0.9));

  moonLight = new THREE.DirectionalLight(0xb4c4ff, 2.6);
  const ldir = new THREE.Vector3(MOON_SKY.x * 0.6, 1, MOON_SKY.z * 0.6).normalize();
  moonLight.position.set(CX + ldir.x * 450, 80 + ldir.y * 450, CZ + ldir.z * 450);
  moonLight.target.position.set(CX, 80, CZ);
  scene.add(moonLight);
  scene.add(moonLight.target);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(4096, 4096);
  moonLight.shadow.camera.left = -200;
  moonLight.shadow.camera.right = 200;
  moonLight.shadow.camera.top = 200;
  moonLight.shadow.camera.bottom = -200;
  moonLight.shadow.camera.near = 1;
  moonLight.shadow.camera.far = 1000;
  moonLight.shadow.bias = -0.0004;
  moonLight.shadow.normalBias = 0.35;
  moonLight.shadow.radius = 3;

  voxelGroup = new THREE.Group();
  scene.add(voxelGroup);
  cloudGroup.position.set(CX, 0, CZ);                    // pivot at the island centre
  scene.add(cloudGroup);

  buildStars();
  buildMoon();
  initCar();
  initComposer();
}

function initComposer() {
  composer = new EffectComposer(renderer);
  renderPass = new RenderPass(scene, camPersp);
  composer.addPass(renderPass);
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.35, 0.85));
  composer.addPass(new OutputPass());
}

/* ---------------- stars ---------------- */
function buildStars() {
  const N = 2200, R0 = 1800;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = rnd() * TAU;
    const v = rnd() * 2 - 1;
    const s = Math.sqrt(1 - v * v);
    const y = Math.abs(v) * 0.9 + 0.1;                    // dome bias
    pos[i * 3] = Math.cos(a) * s * R0;
    pos[i * 3 + 1] = y * R0;
    pos[i * 3 + 2] = Math.sin(a) * s * R0;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xcdd8ff, size: 1.6, sizeAttenuation: false, depthWrite: false
  }));
  scene.add(stars);
}

/* ---------------- voxel moon ---------------- */
function buildMoon() {
  const CELL = 3, RN = 6;
  const pos = [], nor = [], idx = [];
  const boxFaces = [
    [[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]],
    [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]],
    [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
    [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
    [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
    [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]]
  ];
  const inside = (x, y, z) =>
    x >= -RN && x <= RN && y >= -RN && y <= RN && z >= -RN && z <= RN &&
    x * x + y * y + z * z <= RN * RN + RN;
  for (let y = -RN; y <= RN; y++)
    for (let z = -RN; z <= RN; z++)
      for (let x = -RN; x <= RN; x++) {
        if (!inside(x, y, z)) continue;
        const fs = [];
        if (!inside(x + 1, y, z)) fs.push(boxFaces[0]);
        if (!inside(x - 1, y, z)) fs.push(boxFaces[1]);
        if (!inside(x, y + 1, z)) fs.push(boxFaces[2]);
        if (!inside(x, y - 1, z)) fs.push(boxFaces[3]);
        if (!inside(x, y, z + 1)) fs.push(boxFaces[4]);
        if (!inside(x, y, z - 1)) fs.push(boxFaces[5]);
        for (const fc of fs) {
          const base = pos.length / 3;
          for (const c of fc[1]) {
            pos.push(x * CELL + c[0] * CELL / 2, y * CELL + c[1] * CELL / 2, z * CELL + c[2] * CELL / 2);
            nor.push(fc[0][0], fc[0][1], fc[0][2]);
          }
          idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  moonMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.1, 2.1, 2.0) }));
  scene.add(moonMesh);
}

// project the moon as a point at infinity — pan/zoom leave it in place
function updateMoon(cam, dir, target, halfH, tanV, aspect) {
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
  const r = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
  const u = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
  const lx = MOON_SKY.dot(r), ly = MOON_SKY.dot(u), lz = -MOON_SKY.dot(dir);
  if (lz <= 0.05) { moonMesh.visible = false; return; }
  const ndcX = (lx / lz) / (tanV * aspect);
  const ndcY = (ly / lz) / tanV;
  moonMesh.visible = true;
  moonMesh.position.copy(target)
    .addScaledVector(dir, -1400)
    .addScaledVector(u, ndcY * halfH)
    .addScaledVector(r, ndcX * halfH * aspect);
  const s = halfH / 300;
  moonMesh.scale.set(s, s, s);
}

/* ---------------- clouds ---------------- */
function buildClouds() {
  const mat = new THREE.MeshLambertMaterial({
    color: 0x8792b8, emissive: 0x10162e, transparent: true, opacity: 0.62,
    depthWrite: false
  });
  const spec = [];
  for (let i = 0; i < 26; i++) {
    const a = rnd() * TAU;
    const r2 = lerp(R - 12, R + 28, rnd());
    const y = lerp(LAKE_Y - 52, LAKE_Y - 12, rnd());
    spec.push({ x: CX + Math.cos(a) * r2, y, z: CZ + Math.sin(a) * r2, n: ri(3, 7), sc: 1 });
  }
  for (let i = 0; i < 4; i++) {
    const a = rnd() * TAU, r2 = rr(420, 720);
    spec.push({ x: CX + Math.cos(a) * r2, y: rr(140, 320), z: CZ + Math.sin(a) * r2, n: ri(4, 7), sc: 2.2 });
  }

  for (const sp of spec) {
    // union of 3–7 ellipsoids voxelized at 2-unit cells
    const ells = [];
    for (let e = 0; e < sp.n; e++) {
      ells.push({
        cx: rr(-10, 10) * sp.sc, cy: rr(-2.5, 2.5) * sp.sc, cz: rr(-7, 7) * sp.sc,
        rx: rr(5, 10) * sp.sc, ry: rr(2.2, 4) * sp.sc, rz: rr(4, 8) * sp.sc
      });
    }
    let ext = 2;
    for (const e of ells)
      ext = Math.max(ext, Math.ceil(Math.max(Math.abs(e.cx) + e.rx, Math.abs(e.cy) + e.ry, Math.abs(e.cz) + e.rz)) + 1);
    const dim = ext * 2 + 1;
    const gridC = new Uint8Array(dim * dim * dim);
    const gi = (x, y, z) => (x + ext) + dim * ((z + ext) + dim * (y + ext));
    for (let y = -ext; y <= ext; y++)
      for (let z = -ext; z <= ext; z++)
        for (let x = -ext; x <= ext; x++) {
          for (const e of ells) {
            const dx = (x - e.cx) / e.rx, dy = (y - e.cy) / e.ry, dz = (z - e.cz) / e.rz;
            if (dx * dx + dy * dy + dz * dz <= 1) { gridC[gi(x, y, z)] = 1; break; }
          }
        }
    // simple face culling (cell size 2)
    const pos = [], nor = [], idx = [];
    const CS = 2;
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const quads = [
      [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]],
      [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]],
      [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
      [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
      [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
      [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]
    ];
    for (let y = -ext; y <= ext; y++)
      for (let z = -ext; z <= ext; z++)
        for (let x = -ext; x <= ext; x++) {
          if (!gridC[gi(x, y, z)]) continue;
          for (let d = 0; d < 6; d++) {
            const dd = dirs[d];
            const nx = x + dd[0], ny = y + dd[1], nz = z + dd[2];
            if (nx >= -ext && nx <= ext && ny >= -ext && ny <= ext &&
                nz >= -ext && nz <= ext && gridC[gi(nx, ny, nz)]) continue;
            const base = pos.length / 3;
            for (const c of quads[d]) {
              pos.push((x + c[0] * 0.5) * CS, (y + c[1] * 0.5) * CS, (z + c[2] * 0.5) * CS);
              nor.push(dd[0], dd[1], dd[2]);
            }
            idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        }
    if (!idx.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(sp.x - CX, sp.y, sp.z - CZ);        // group pivot at island centre
    cloudGroup.add(mesh);
    cloudList.push({ mesh, baseY: sp.y, ph: rnd() * TAU });
  }
}

function updateClouds(t, dt) {
  cloudGroup.rotation.y += dt * 0.004;
  for (let i = 0; i < cloudList.length; i++) {
    const c = cloudList[i];
    c.mesh.position.y = c.baseY + Math.sin(t * 0.25 + c.ph) * 1.5;
  }
}

/* ---------------- point lights ---------------- */
function addPointLights() {
  for (const L of LIGHTS) {
    if (pointLights.length >= 14) break;
    const pl = new THREE.PointLight(0xffa24d, 38 * L.s, 44, 1.3);
    pl.position.set(L.x, L.y, L.z);
    scene.add(pl);
    pointLights.push({ pl, base: 38 * L.s, ph: rnd() * TAU });
  }
}
function flickerLights(t) {
  for (let i = 0; i < pointLights.length; i++) {
    const L = pointLights[i];
    const f = 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(t * 6.3 + L.ph) * Math.sin(t * 2.7 + L.ph * 1.7));
    L.pl.intensity = L.base * f;
  }
}

/* ---------------- flying Ford Anglia ---------------- */
let carGroup, carBeam;
const carState = { th: 0.7 };

function voxBox(arr, x0, y0, z0, x1, y1, z1, col) {
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) arr.push([x, y, z, col]);
}
// merged culled voxel cells → geometry with vertex colours
function voxGeom(cells) {
  const occ = new Set();
  for (const c of cells) occ.add(c[0] + ',' + c[1] + ',' + c[2]);
  const pos = [], nor = [], col = [], idx = [];
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const quads = [
    [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]],
    [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]],
    [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
    [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
    [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]
  ];
  for (const c of cells) {
    const x = c[0], y = c[1], z = c[2], cr = c[3];
    for (let f = 0; f < 6; f++) {
      const d = dirs[f];
      if (occ.has((x + d[0]) + ',' + (y + d[1]) + ',' + (z + d[2]))) continue;
      const base = pos.length / 3;
      for (const k of quads[f]) {
        pos.push(x + k[0] * 0.5, y + k[1] * 0.5, z + k[2] * 0.5);
        nor.push(d[0], d[1], d[2]);
        col.push(cr[0], cr[1], cr[2]);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
// unlit over-bright lamp cells
function lampGeom(cells) {
  const pos = [], nor = [], idx = [];
  const quads = [
    [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]],
    [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]],
    [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
    [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
    [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]
  ];
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const c of cells) {
    for (let f = 0; f < 6; f++) {
      const d = dirs[f];
      const base = pos.length / 3;
      for (const k of quads[f]) {
        pos.push(c[0] + k[0] * 0.5, c[1] + k[1] * 0.5, c[2] + k[2] * 0.5);
        nor.push(d[0], d[1], d[2]);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

function initCar() {
  const lin = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
  const CARB = lin(0x6d9cc2), GLASSB = lin(0x2c3a5a);
  const CHROME = lin(0xb8bec6), TYRE = lin(0x141418);
  const body = [];
  voxBox(body, -2, 0, -4, 1, 0, 3, CARB);                       // 4×8 chassis, front = +z
  voxBox(body, -2, 1, -3, 1, 1, 2, CARB);                       // cabin row 1
  for (let x = -2; x <= 1; x++)                                 // window band with corner pillars
    for (let z = -3; z <= 2; z++) {
      const perimeter = x === -2 || x === 1 || z === -3 || z === 2;
      if (!perimeter) continue;
      const pillar = (x === -2 || x === 1) && (z === -3 || z === 2);
      body.push([x, 2, z, pillar ? CARB : GLASSB]);
    }
  voxBox(body, -2, 3, -3, 1, 3, 2, CARB);                       // roof
  // bumpers (headlight/taillight cells left to the lamp meshes)
  for (let x = -2; x <= 1; x++) {
    if (x !== -1 && x !== 0) body.push([x, 1, 4, CHROME]);
    if (x !== -1 && x !== 0) body.push([x, 1, -5, CHROME]);
  }
  voxBox(body, -3, 0, -3, -3, 0, 2, TYRE);                      // tyres
  voxBox(body, 2, 0, -3, 2, 0, 2, TYRE);
  body.push([-3, 0, -3, TYRE]); body.push([2, 0, -3, TYRE]);
  body.push([-3, 0, 2, TYRE]); body.push([2, 0, 2, TYRE]);

  carGroup = new THREE.Group();
  const bodyMesh = new THREE.Mesh(voxGeom(body),
    new THREE.MeshLambertMaterial({ vertexColors: true }));
  bodyMesh.castShadow = true;
  carGroup.add(bodyMesh);

  const head = new THREE.Mesh(lampGeom([[-1, 1, 5], [0, 1, 5]]),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 1.5) }));
  carGroup.add(head);
  const tail = new THREE.Mesh(lampGeom([[-1, 1, -6], [0, 1, -6]]),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 0.15, 0.15) }));
  carGroup.add(tail);

  carBeam = new THREE.PointLight(0xfff2dd, 45, 45);
  carBeam.position.set(0, 1, 9);                               // 9 units ahead
  carGroup.add(carBeam);

  carGroup.scale.set(1.3, 1.3, 1.3);
  scene.add(carGroup);
}

function updateFlyingCar(t, dt) {
  carState.th += 0.1 * dt;
  const th = carState.th;
  const px = th2 => 148 + 98 * Math.cos(th2);
  const pz = th2 => 145 + 95 * Math.sin(th2);
  const py = th2 => PLAT_Y + 50 + 10 * Math.sin(2 * th2) + 3 * Math.sin(3 * th2);
  const x = px(th), z = pz(th);
  const y = py(th) + 1.2 * Math.sin(2.4 * t) + 0.3 * Math.sin(5.3 * t);
  carGroup.position.set(x, y, z);
  const ahead = 0.12;
  carGroup.lookAt(px(th + ahead), py(th + ahead), pz(th + ahead));
  carGroup.rotateZ(0.16 + 0.1 * Math.sin(1.7 * t));            // bank + wobble
  carGroup.rotateX(0.07 * Math.sin(2.4 * t + 1));              // nose bob
}