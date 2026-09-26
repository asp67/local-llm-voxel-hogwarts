/* ════════════════════════════════════════════════════════════════════
   07_scene.js — renderer, sky, lights, materials, clouds, moon, car
   ════════════════════════════════════════════════════════════════════ */

let renderer, scene, camIso, camPer, composer, rPass, bloomPass;
const MATS = {};
let moonLight, hemiLight, ambLight;
let moonMesh, cloudGroup, carGroup, carLight;
let cloudUnits = [];
let flickers = [];

/* MOON_SKY: 8° above horizon, 45° left of the default view's back direction.
   Default yaw 0.62 → camera forward f = (−sin, 0, −cos) = (−0.581,0,−0.814);
   left = up×f = (−0.814,0,0.581); azimuth = normalize(f+left) = (−0.986,−0.165). */
const MOON_SKY = (() => {
  const az = [-0.9864, -0.1646];
  const cp = Math.cos(8 * DR);
  return new THREE.Vector3(az[0] * cp, Math.sin(8 * DR), az[1] * cp);
})();

function sceneInit() {
  const canvas = document.createElement('canvas');
  document.getElementById('app').appendChild(canvas);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;

  scene = new THREE.Scene();

  /* lights */
  hemiLight = new THREE.HemisphereLight(0x5a6cc0, 0x1a1522, 1.4);
  ambLight  = new THREE.AmbientLight(0x202848, 0.9);
  scene.add(hemiLight, ambLight);
  moonLight = new THREE.DirectionalLight(0xb4c4ff, 3.5);
  const lv = new THREE.Vector3(MOON_SKY.x * 0.6, 1, MOON_SKY.z * 0.6).normalize();
  moonLight.position.set(CX + lv.x * 450, PLAT_Y + lv.y * 450, CZ + lv.z * 450);
  moonLight.target.position.set(CX, PLAT_Y, CZ);
  scene.add(moonLight, moonLight.target);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(4096, 4096);
  const sc = moonLight.shadow.camera;
  sc.left = -200; sc.right = 200; sc.top = 200; sc.bottom = -200;
  sc.near = 100; sc.far = 1100;
  moonLight.shadow.bias = -0.0004;
  moonLight.shadow.normalBias = 0.35;
  moonLight.shadow.radius = 3;

  /* materials */
  MATS.solid = new THREE.MeshLambertMaterial({ vertexColors: true });
  MATS.emis  = new THREE.MeshBasicMaterial({ vertexColors: true });
  MATS.emis.color.setRGB(1.9, 1.9, 1.9);
  MATS.water = new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.8,
    shininess: 90, specular: 0x5c74b8, depthWrite: false });
  MATS.glass = new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.5,
    shininess: 60, specular: 0x9fd8c8, emissive: 0x14261c });

  /* gradient night dome */
  {
    const geo = new THREE.SphereGeometry(2600, 32, 24);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    const STOPS = [[0, 0x050817], [0.36, 0x0b1336], [0.62, 0x15215a], [0.82, 0x1c2a6a],
                   [1, 0x1c2a6a]];
    const cA = new THREE.Color(), cB = new THREE.Color(), cT = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = clamp((pos.getY(i) / 2600 + 1) / 2, 0, 1);
      let s = 0;
      while (s < STOPS.length - 2 && t > STOPS[s + 1][0]) s++;
      const [t0, h0] = STOPS[s], [t1, h1] = STOPS[s + 1];
      cA.setHex(h0); cB.setHex(h1);
      cT.copy(cA).lerp(cB, clamp((t - t0) / (t1 - t0), 0, 1));
      col[i * 3] = cT.r; col[i * 3 + 1] = cT.g; col[i * 3 + 2] = cT.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false }));
    dome.renderOrder = -3; dome.frustumCulled = false;
    scene.add(dome);
  }

  /* stars */
  {
    const N2 = 2200, p = new Float32Array(N2 * 3), colS = new Float32Array(N2 * 3);
    const cT = new THREE.Color();
    for (let i = 0; i < N2; i++) {
      let x, y, z2;
      do {
        x = rnd() * 2 - 1; y = rnd() * 2 - 1; z2 = rnd() * 2 - 1;
      } while (x * x + y * y + z2 * z2 > 1 || y < -0.06);
      const l = 1800 / Math.hypot(x, y, z2);
      p[i * 3] = CX + x * l; p[i * 3 + 1] = PLAT_Y + y * l; p[i * 3 + 2] = CZ + z2 * l;
      cT.setHSL(0.58 + rnd() * 0.09, rnd() * 0.35, 0.72 + rnd() * 0.28);
      colS[i * 3] = cT.r; colS[i * 3 + 1] = cT.g; colS[i * 3 + 2] = cT.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colS, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({
      size: 1.6, sizeAttenuation: false, vertexColors: true,
      depthWrite: false, depthTest: false, fog: false }));
    pts.renderOrder = -2; pts.frustumCulled = false;
    scene.add(pts);
  }

  /* cameras + composer */
  camIso = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 8000);
  camPer = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 8000);
  composer = new EffectComposer(renderer);
  rPass = new RenderPass(scene, camIso);
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.35, 0.85);
  composer.addPass(rPass);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  buildClouds();
  buildMoon();
  buildFlyingCar();
}

/* ── clouds ── */
const CLOUDM = new THREE.MeshLambertMaterial({
  color: 0x7783ab, transparent: true, opacity: 0.62, emissive: 0x10162e, depthWrite: false });

function makeCloudCell() {
  const cells = new Set();
  const lumps = [];
  const nE = 3 + Math.floor(rnd() * 5);
  for (let e = 0; e < nE; e++)
    lumps.push({
      x: (rnd() * 2 - 1) * 12, y: (rnd() * 2 - 1) * 3, z: (rnd() * 2 - 1) * 12,
      rx: 5 + rnd() * 8, ry: 3 + rnd() * 3.5, rz: 5 + rnd() * 8
    });
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, zz0 = 1e9, zz1 = -1e9;
  for (const L of lumps) {
    x0 = Math.min(x0, L.x - L.rx); x1 = Math.max(x1, L.x + L.rx);
    y0 = Math.min(y0, L.y - L.ry); y1 = Math.max(y1, L.y + L.ry);
    zz0 = Math.min(zz0, L.z - L.rz); zz1 = Math.max(zz1, L.z + L.rz);
  }
  for (let z = Math.floor(zz0 / 2); z <= Math.ceil(zz1 / 2); z++)
    for (let y = Math.floor(y0 / 2); y <= Math.ceil(y1 / 2); y++)
      for (let x = Math.floor(x0 / 2); x <= Math.ceil(x1 / 2); x++) {
        const px = x * 2, py = y * 2, pz = z * 2;
        for (const L of lumps) {
          const dx = (px - L.x) / L.rx, dy = (py - L.y) / L.ry, dz = (pz - L.z) / L.rz;
          if (dx * dx + dy * dy + dz * dz <= 1) { cells.add(x + ',' + y + ',' + z); break; }
        }
      }
  return cells;
}

function buildClouds() {
  cloudGroup = new THREE.Group();
  cloudGroup.position.set(CX, 0, CZ);                     /* pivot = island centre */
  for (let i = 0; i < 26; i++) {
    const ang = rnd() * Math.PI * 2, rr = (R - 12) + rnd() * 40;
    const cx = CX + Math.cos(ang) * rr, cz = CZ + Math.sin(ang) * rr;
    const yy = LAKE_Y - 52 + rnd() * 40;
    const g = new THREE.Mesh(meshCells(makeCloudCell(), 2, [1, 1, 1]), CLOUDM);
    g.position.set(cx - CX, yy, cz - CZ);
    cloudGroup.add(g);
    cloudUnits.push({ mesh: g, baseY: yy, ph: rnd() * 6.28, sp: 0.35 + rnd() * 0.5 });
  }
  for (let i = 0; i < 4; i++) {
    const ang = rnd() * Math.PI * 2, rr = 175 + rnd() * 105;
    const cx = CX + Math.cos(ang) * rr, cz = CZ + Math.sin(ang) * rr, yy = 130 + rnd() * 42;
    const g = new THREE.Mesh(meshCells(makeCloudCell(), 2, [1, 1, 1]), CLOUDM);
    g.position.set(cx - CX, yy, cz - CZ);
    cloudGroup.add(g);
    cloudUnits.push({ mesh: g, baseY: yy, ph: rnd() * 6.28, sp: 0.35 + rnd() * 0.5 });
  }
  scene.add(cloudGroup);
}

/* ── the voxel moon ── */
function buildMoon() {
  const cells = new Set(), R2 = 6.35 * 6.35;
  for (let z = -7; z <= 7; z++) for (let y = -7; y <= 7; y++)
    for (let x = -7; x <= 7; x++) {
      const d2 = x * x + y * y + z * z;
      if (d2 <= R2 && hash(x, y, z, 311) > 0.06) cells.add(x + ',' + y + ',' + z);
    }
  moonMesh = new THREE.Mesh(meshCells(cells, 3, [1.28, 1.22, 1.08]),
    new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  moonMesh.renderOrder = -1;
  moonMesh.frustumCulled = false;
  scene.add(moonMesh);
}

/* re-project the moon into the sky every frame */
function updateMoon() {
  const dx = Math.sin(view.yaw) * Math.cos(view.pitch);
  const dy = Math.sin(view.pitch);
  const dz = Math.cos(view.yaw) * Math.cos(view.pitch);
  const fx = -dx, fyv = -dy, fz = -dz;                    /* camera forward   */
  let rx = -fz, ry = 0, rz = fx;                          /* right = fwd × up */
  const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  const ux = ry * fz - rz * fyv, uy = rz * fx - rx * fz, uz2 = rx * fyv - ry * fx;
  /* up = right × fwd */
  const lx = MOON_SKY.x * rx + MOON_SKY.y * 0 + MOON_SKY.z * rz;
  const ly = MOON_SKY.x * ux + MOON_SKY.y * uy + MOON_SKY.z * uz2;
  const lz = -(MOON_SKY.x * dx + MOON_SKY.y * dy + MOON_SKY.z * dz);
  if (lz <= 0.05) { moonMesh.visible = false; return; }
  moonMesh.visible = true;
  const iso = view.ortho;
  const tanV = iso ? 1.42815 : Math.tan(22.5 * DR);
  const aspect = innerWidth / innerHeight;
  const halfH = view.dist * (iso ? 0.42 : tanV);
  const ndcX = (lx / lz) / (tanV * aspect);
  const ndcY = (ly / lz) / tanV;
  const px = view.tx - dx * 1400 + ux * ndcY * halfH + rx * ndcX * halfH * aspect;
  const py = view.ty - dy * 1400 + uy * ndcY * halfH + 0 * ndcX * halfH * aspect;
  const pz = view.tz - dz * 1400 + uz2 * ndcY * halfH + rz * ndcX * halfH * aspect;
  moonMesh.position.set(px, py, pz);
  moonMesh.scale.setScalar(Math.max(0.35, halfH / 300));
}

/* ── the flying Ford Anglia ── */
function buildFlyingCar() {
  const parts = [
    { x: 0, y: -1.7, z: 0, sx: 4, sy: 1.3, sz: 8.2, hex: '#6d9cc2' },      // chassis
    { x: 0, y: -0.75, z: 3.0, sx: 3.7, sy: 0.7, sz: 2.6, hex: '#6d9cc2' }, // bonnet
    { x: 0, y: -0.75, z: -2.7, sx: 3.7, sy: 0.7, sz: 3.2, hex: '#6d9cc2' },// boot
    { x: 0, y: -2.0, z: 4.35, sx: 3.3, sy: 0.8, sz: 0.9, hex: '#b8bec6' }, // chrome F
    { x: 0, y: -2.0, z: -4.35, sx: 3.3, sy: 0.8, sz: 0.9, hex: '#b8bec6' },// chrome R
    { x: 0, y: 0.15, z: 0.55, sx: 3.4, sy: 1.45, sz: 4.7, hex: '#2c3a5a' },// window band
    { x: -1.75, y: 0.15, z: 2.35, sx: 0.7, sy: 1.45, sz: 0.7, hex: '#6d9cc2' },
    { x: 1.75,  y: 0.15, z: 2.35, sx: 0.7, sy: 1.45, sz: 0.7, hex: '#6d9cc2' },
    { x: -1.75, y: 0.15, z: -1.35, sx: 0.7, sy: 1.45, sz: 0.7, hex: '#6d9cc2' },
    { x: 1.75,  y: 0.15, z: -1.35, sx: 0.7, sy: 1.45, sz: 0.7, hex: '#6d9cc2' },
    { x: 0, y: 1.05, z: 0.55, sx: 4.1, sy: 0.55, sz: 5.7, hex: '#6d9cc2' }, // blue roof
    { x: -1.95, y: -2.55, z: 2.6, sx: 1.15, sy: 2.3, sz: 2.3, hex: '#141419' },
    { x: 1.95,  y: -2.55, z: 2.6, sx: 1.15, sy: 2.3, sz: 2.3, hex: '#141419' },
    { x: -1.95, y: -2.55, z: -2.6, sx: 1.15, sy: 2.3, sz: 2.3, hex: '#141419' },
    { x: 1.95,  y: -2.55, z: -2.6, sx: 1.15, sy: 2.3, sz: 2.3, hex: '#141419' },
    { x: -1.2, y: -1.45, z: 4.5, sx: 0.95, sy: 0.75, sz: 0.45, hex: '#fff3d8', glow: true, lum: 2.4 },
    { x: 1.2,  y: -1.45, z: 4.5, sx: 0.95, sy: 0.75, sz: 0.45, hex: '#fff3d8', glow: true, lum: 2.2 },
    { x: -1.35, y: -1.45, z: -4.5, sx: 0.9, sy: 0.6, sz: 0.4, hex: '#ff4038', glow: true, lum: 1.5 },
    { x: 1.35,  y: -1.45, z: -4.5, sx: 0.9, sy: 0.6, sz: 0.4, hex: '#ff4038', glow: true, lum: 1.5 }
  ];
  const g = miniMesh(parts);
  carGroup = new THREE.Group();
  const mS = new THREE.Mesh(g.solid, MATS.solid); mS.castShadow = true;
  const mG = new THREE.Mesh(g.glow, MATS.emis);
  carGroup.add(mS, mG);
  carGroup.scale.setScalar(1.3);
  carLight = new THREE.PointLight(0xffe2b0, 45, 45, 1.6);
  carLight.position.set(0, -0.8, 9);
  carGroup.add(carLight);
  scene.add(carGroup);
}

let carTheta = 0;
function updateFlyingCar(t, dt) {
  carTheta += 0.1 * dt;
  const th = carTheta;
  const px = 148 + 98 * Math.cos(th);
  const py = PLAT_Y + 50 + 10 * Math.sin(2 * th) + 3 * Math.sin(3 * th);
  const pz = 145 + 95 * Math.sin(th);
  const bob = 1.2 * Math.sin(2.4 * t) + 0.3 * Math.sin(5.3 * t);
  carGroup.position.set(px, py + bob, pz);
  const th2 = th + 0.09;
  carGroup.lookAt(148 + 98 * Math.cos(th2),
                  PLAT_Y + 50 + 10 * Math.sin(2 * th2) + 3 * Math.sin(3 * th2),
                  145 + 95 * Math.sin(th2));
  carGroup.rotateZ(0.16 + 0.1 * Math.sin(1.7 * t));
  carGroup.rotateX(0.07 * Math.sin(2.4 * t + 1));
}

/* lantern flicker */
function buildPointLights() {
  for (const p of POINTS) {
    const L = new THREE.PointLight(0xffa24d, 38 * p.s, 44, 1.3);
    L.position.set(p.x, p.y, p.z);
    scene.add(L);
    flickers.push({ L, s: p.s, ph: rnd() * 40 });
  }
}
function updateLights(t) {
  for (const f of flickers)
    f.L.intensity = 38 * f.s * (0.84 + 0.16 * vnoise(t * 5 + f.ph, f.ph * 2, 999));
}

function updateClouds(t, dt) {
  cloudGroup.rotation.y += dt * 0.0035;
  for (const c of cloudUnits) {
    c.mesh.position.y = c.baseY + Math.sin(t * c.sp + c.ph) * 1.6;
  }
}

/* warm point-light list is built after chunk meshes */
function addPointLights() { buildPointLights(); }
