
// ============================================================================
// 10. RENDERER, SKY, LIGHTS, MATERIALS
// ============================================================================
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.prepend(renderer.domElement);
renderer.domElement.tabIndex = 0;

const scene = new THREE.Scene();
{ // dark-blue night gradient
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#050817'); gr.addColorStop(0.45, '#0b1336'); gr.addColorStop(0.8, '#15215a'); gr.addColorStop(1, '#1c2a6a');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
}
const CENTER = new THREE.Vector3(CX, PLAT_Y - 10, CZ);

// Cameras: isometric orthographic (default) and perspective (free flight)
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
const perspCam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 5000);

// Lights
const hemi = new THREE.HemisphereLight(0x5a6cc0, 0x1a1522, 1.1); scene.add(hemi);
scene.add(new THREE.AmbientLight(0x202848, 0.9));
const moon = new THREE.DirectionalLight(0xb4c4ff, 2.6);
// The moon sits at a fixed direction in the sky (at infinity): low in the west, chosen so it appears
// in the upper-left of the default isometric view (yaw 0.62). The moonlight shares its azimuth but
// comes from higher up, which keeps the shadows short.
const MOON_SKY = (() => {
  const yaw = 0.62, az = -Math.PI / 4, el = THREE.MathUtils.degToRad(8);
  const back = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  return back.multiplyScalar(Math.cos(az)).addScaledVector(right, Math.sin(az)).multiplyScalar(Math.cos(el)).setY(Math.sin(el)).normalize();
})();
const MOON_DIR = new THREE.Vector3(MOON_SKY.x * 0.6, 1.0, MOON_SKY.z * 0.6).normalize();
moon.position.copy(CENTER).addScaledVector(MOON_DIR, 450);
moon.target.position.copy(CENTER);
moon.castShadow = true;
moon.shadow.mapSize.set(4096, 4096);
Object.assign(moon.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 50, far: 1000 });
moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.35; moon.shadow.radius = 3;
scene.add(moon, moon.target);

// Materials
const MATS = {
  1: new THREE.MeshLambertMaterial({ vertexColors: true }),
  2: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.9, 1.9, 1.9) }),
  3: new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.8, shininess: 90, specular: 0x5c74b8, depthWrite: false }),
  4: new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.5, shininess: 60, specular: 0x88aacc, emissive: 0x0b2a1c }),
};

function addChunkMeshes(onProgress) {
  const bufs = { 1: new GeoBuf(), 2: new GeoBuf(), 3: new GeoBuf(), 4: new GeoBuf() };
  const list = [];
  for (let y = 0; y < H; y += CS) for (let z = 0; z < D; z += CS) for (let x = 0; x < W; x += CS) list.push([x, y, z]);
  let tris = 0, i = 0;
  return (async () => {
    for (const [x, y, z] of list) {
      meshChunk(x, y, z, bufs);
      for (const k of [1, 2, 3, 4]) {
        const g = bufs[k].geometry(); if (!g) continue;
        tris += g.index.count / 3;
        const m = new THREE.Mesh(g, MATS[k]);
        m.castShadow = k <= 2; m.receiveShadow = k !== 2;
        if (k >= 3) m.renderOrder = k;
        m.matrixAutoUpdate = false;
        scene.add(m);
      }
      if (++i % 6 === 0) { onProgress(i / list.length); await tick(); }
    }
    return tris;
  })();
}

// Small standalone voxel sets (clouds, moon) meshed with simple culling.
function miniMesh(cells, size, color) {
  const key = (x, y, z) => x + ',' + y + ',' + z, has = new Set(cells.map(c => key(...c)));
  const pos = [], nor = [], col = [], idx = [];
  for (const [x, y, z] of cells) for (const F of FACES) {
    if (has.has(key(x + F.n[0], y + F.n[1], z + F.n[2]))) continue;
    const vb = pos.length / 3, sh = 0.9 + hash(x, y, z) * 0.2;
    for (let c = 0; c < 4; c++) {
      const cu = (c === 1 || c === 2) ? 1 : 0, cv = c >= 2 ? 1 : 0;
      pos.push((x + F.o[0] + F.u[0] * cu + F.v[0] * cv) * size, (y + F.o[1] + F.u[1] * cu + F.v[1] * cv) * size, (z + F.o[2] + F.u[2] * cu + F.v[2] * cv) * size);
      nor.push(...F.n); col.push(color.r * sh, color.g * sh, color.b * sh);
    }
    idx.push(vb, vb + 1, vb + 2, vb, vb + 2, vb + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}

const cloudGroup = new THREE.Group(); scene.add(cloudGroup);
function buildClouds() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.62, emissive: 0x10162e, depthWrite: false });
  const white = new THREE.Color(0x8792b8);
  const rc = mulberry32(777);
  for (let n = 0; n < 30; n++) {
    const cells = [], blobs = 3 + Math.floor(rc() * 5), low = n < 26;
    for (let b = 0; b < blobs; b++) {
      const bx = (rc() - 0.5) * 22, by = rc() * 2, bz = (rc() - 0.5) * 12, rx = 4 + rc() * 6, ry = 1.5 + rc() * 2, rz = 3 + rc() * 5;
      for (let x = Math.floor(bx - rx); x <= bx + rx; x++) for (let y = Math.floor(by - ry); y <= by + ry; y++) for (let z = Math.floor(bz - rz); z <= bz + rz; z++)
        if (((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2 + ((z - bz) / rz) ** 2 <= 1 && y >= 0) cells.push([x, y, z]);
    }
    const uniq = [...new Map(cells.map(c => [c.join(','), c])).values()];
    const m = new THREE.Mesh(miniMesh(uniq, 2, white), mat);
    const a = low ? (n / 26) * Math.PI * 2 + rc() * 0.2 : rc() * Math.PI * 2, d = low ? R - 12 + rc() * 40 : R + 90 + rc() * 60;
    m.position.set(Math.cos(a) * d, low ? LAKE_Y - 52 + rc() * 40 : PLAT_Y + 60 + rc() * 30, Math.sin(a) * d);
    m.rotation.y = rc() * Math.PI;
    m.userData.bob = rc() * 6; m.renderOrder = 5;
    cloudGroup.add(m);
  }
  cloudGroup.position.set(CX, 0, CZ);
}

// Stars
{
  const n = 2200, p = new Float32Array(n * 3), rs = mulberry32(42);
  for (let i = 0; i < n; i++) {
    const u = rs() * 2 - 1, t = rs() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = 1800;
    p[i * 3] = CX + Math.cos(t) * s * r; p[i * 3 + 1] = 40 + Math.abs(u) * r; p[i * 3 + 2] = CZ + Math.sin(t) * s * r;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false, fog: false })));
}

// Voxel moon (placed relative to the default isometric view so it hangs in the sky behind the castle)
const moonMesh = (() => {
  const cells = [];
  for (let x = -6; x <= 6; x++) for (let y = -6; y <= 6; y++) for (let z = -6; z <= 6; z++) if (x * x + y * y + z * z <= 38) cells.push([x, y, z]);
  const g = miniMesh(cells, 3, new THREE.Color(1, 1, 1));
  const cols = g.getAttribute('color');
  for (let i = 0; i < cols.count; i++) { const k = 0.8 + hash(i >> 2, 7, 1) * 0.25; cols.setXYZ(i, 1.25 * k, 1.2 * k, 1.0 * k); }
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  scene.add(m); return m;
})();

// The flying Ford Anglia: a small voxel model (front = +z) that loops around the castle.
const flyingCar = (() => {
  const P = { body: [], chrome: [], glass: [], tyre: [], head: [], tail: [] };
  for (let z = -4; z <= 3; z++) for (let x = -2; x <= 1; x++) {
    const end = z === -4 || z === 3, side = x === -2 || x === 1;
    for (let y = 0; y <= 1; y++) {
      if (end && y === 1 && side) P[z === 3 ? 'head' : 'tail'].push([x, y, z]);
      else if (end && y === 0) P.chrome.push([x, y, z]);
      else P.body.push([x, y, z]);
    }
    if (z >= -2 && z <= 1) {
      const rim = side || z === -2 || z === 1, pillar = side && (z === -2 || z === 1);
      P[rim && !pillar ? 'glass' : 'body'].push([x, 2, z]);
      P.body.push([x, 3, z]);
    }
  }
  for (const x of [-2, 1]) for (const z of [-3, 2]) P.tyre.push([x, -1, z]);
  const lam = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glassMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 100, specular: 0x8899cc });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const g = new THREE.Group();
  for (const [k, hex, m] of [['body', 0x6d9cc2, lam], ['chrome', 0xb8bec6, lam], ['glass', 0x2c3a5a, glassMat], ['tyre', 0x151518, lam]]) {
    const mesh = new THREE.Mesh(miniMesh(P[k], 1, new THREE.Color(hex)), m); mesh.castShadow = true; g.add(mesh);
  }
  g.add(new THREE.Mesh(miniMesh(P.head, 1, new THREE.Color(2.4, 2.2, 1.5)), glow));
  g.add(new THREE.Mesh(miniMesh(P.tail, 1, new THREE.Color(2.2, 0.25, 0.1)), glow));
  const beam = new THREE.PointLight(0xfff0c8, 45, 45, 1.2); beam.position.set(0, 1.5, 9); g.add(beam);
  g.scale.setScalar(1.3);
  scene.add(g);
  return g;
})();
const carFlight = { theta: 0.4 };
// Elliptical loop around the castle, clear of every spire; gentle swoops plus the classic bob & wobble.
const carPath = a => new THREE.Vector3(148 + 98 * Math.cos(a), PLAT_Y + 50 + 10 * Math.sin(2 * a) + 3 * Math.sin(3 * a), 145 + 95 * Math.sin(a));
function updateFlyingCar(t, dt) {
  const th = (carFlight.theta += dt * 0.1);
  const bob = Math.sin(t * 2.4) * 1.2 + Math.sin(t * 5.3) * 0.3;
  const p = carPath(th), ahead = carPath(th + 0.03);
  flyingCar.position.set(p.x, p.y + bob, p.z);
  flyingCar.lookAt(ahead.x, ahead.y + bob + Math.cos(t * 2.4) * 0.6, ahead.z);
  flyingCar.rotateZ(0.16 + Math.sin(t * 1.7) * 0.1);   // bank into the turn + side-to-side wobble
  flyingCar.rotateX(Math.sin(t * 2.4 + 1) * 0.07);     // nose bob
}

// Warm point lights from windows, fountains, lanterns
function addPointLights() {
  for (const [x, y, z, s = 1] of LIGHTS.warm.slice(0, 14)) {
    const l = new THREE.PointLight(0xffa24d, 38 * s, 44, 1.3);
    l.position.set(x + 0.5, y, z + 0.5); l.userData.base = l.intensity; l.userData.ph = Math.random() * 10;
    scene.add(l); FLICKER.push(l);
  }
}
const FLICKER = [];

// Post-processing: bloom for the glowing windows & lanterns
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, orthoCam);
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.35, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());
