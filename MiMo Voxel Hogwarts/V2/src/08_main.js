/* ============================================================
   08_main.js — camera controls, build pipeline, render loop
   (PROJECT.md §12 & §13)
   ============================================================ */

const view = {
  target: new THREE.Vector3(CX + 4, PLAT_Y - 4, CZ + 4),
  yaw: 0.62, pitch: 0.6155, dist: 330, distGoal: 330,
  ortho: true
};
const HOME = { yaw: 0.62, pitch: 0.6155, dist: 330 };
let autoOrbit = false;
const keys = {};
let triCount = 0;
let activeCam = null;

function camDir() {
  const cp = Math.cos(view.pitch);
  return new THREE.Vector3(
    Math.sin(view.yaw) * cp,
    Math.sin(view.pitch),
    Math.cos(view.yaw) * cp
  );
}

function updateCamera() {
  const dir = camDir();
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  if (view.ortho) {
    const halfH = view.dist * 0.42;
    camOrtho.left = -halfH * aspect; camOrtho.right = halfH * aspect;
    camOrtho.top = halfH; camOrtho.bottom = -halfH;
    camOrtho.updateProjectionMatrix();
    camOrtho.position.copy(view.target).addScaledVector(dir, 1500);
    camOrtho.lookAt(view.target);
    activeCam = camOrtho;
  } else {
    camPersp.aspect = aspect;
    camPersp.updateProjectionMatrix();
    camPersp.position.copy(view.target).addScaledVector(dir, view.dist);
    camPersp.lookAt(view.target);
    activeCam = camPersp;
  }
  renderPass.camera = activeCam;
}

function updateMoonView() {
  const dir = camDir();
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  if (view.ortho) {
    updateMoon(activeCam, dir, view.target, view.dist * 0.42, Math.tan(55 * DEG), aspect);
  } else {
    const tanV = Math.tan(22.5 * DEG);
    updateMoon(activeCam, dir, view.target, 1400 * tanV, tanV, aspect);
  }
}

/* ---------------- input ---------------- */
const k = code => !!keys[code];

function applyKeys(dt) {
  let sp = Math.max(12, view.dist * 0.75) * dt;
  if (k('ShiftLeft') || k('ShiftRight')) sp *= 3;
  const dir = camDir();
  const fwd = view.ortho
    ? new THREE.Vector3(-Math.sin(view.yaw), 0, -Math.cos(view.yaw))
    : dir.clone().negate();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
  if (right.lengthSq() > 1e-6) right.normalize();
  const move = new THREE.Vector3();
  if (k('KeyW')) move.add(fwd);
  if (k('KeyS')) move.sub(fwd);
  if (k('KeyD')) move.add(right);
  if (k('KeyA')) move.sub(right);
  if (k('KeyR') || k('Space')) move.y += 1;
  if (k('KeyF') || k('KeyC')) move.y -= 1;
  if (move.lengthSq() > 0) view.target.addScaledVector(move.normalize(), sp);

  let rot = 0;
  if (k('KeyQ') || k('ArrowLeft')) rot -= 1;
  if (k('KeyE') || k('ArrowRight')) rot += 1;
  view.yaw += rot * 1.6 * dt;
  if (autoOrbit) view.yaw += 0.15 * dt;
  if (k('ArrowUp')) view.pitch = clamp(view.pitch + 1.2 * dt, 0.03, 1.5);
  if (k('ArrowDown')) view.pitch = clamp(view.pitch - 1.2 * dt, 0.03, 1.5);

  let z = 0;
  if (k('Equal') || k('NumpadAdd') || k('KeyZ') || k('PageUp')) z += 1;
  if (k('Minus') || k('NumpadSubtract') || k('KeyX') || k('PageDown')) z -= 1;
  if (z !== 0) view.distGoal = clamp(view.distGoal * Math.exp(-z * 2 * dt), 6, 900);
}

function resetView() {
  view.yaw = HOME.yaw; view.pitch = HOME.pitch;
  view.dist = HOME.dist; view.distGoal = HOME.dist;
  view.ortho = true; autoOrbit = false;
  view.target.set(CX + 4, PLAT_Y - 4, CZ + 4);
}

function setupInput() {
  const cv = renderer.domElement;
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
         'PageUp', 'PageDown', 'Home'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyP') view.ortho = !view.ortho;
    else if (e.code === 'KeyT') autoOrbit = !autoOrbit;
    else if (e.code === 'Digit0' || e.code === 'Home') resetView();
    else if (e.code === 'KeyH') document.getElementById('hud').classList.toggle('collapsed');
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const kk in keys) keys[kk] = false; });

  let drag = 0, lastX = 0, lastY = 0;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('mousedown', e => {
    drag = (e.button === 2 || e.button === 1 || e.shiftKey) ? 2 : 1;
    lastX = e.clientX; lastY = e.clientY;
  });
  addEventListener('mouseup', () => { drag = 0; });
  addEventListener('mousemove', e => {
    if (!drag) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (drag === 1) {
      view.yaw -= dx * 0.006;
      view.pitch = clamp(view.pitch + dy * 0.006, 0.03, 1.5);
    } else {
      panBy(dx, dy);
    }
  });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    view.distGoal = clamp(view.distGoal * Math.pow(1.12, Math.sign(e.deltaY)), 6, 900);
  }, { passive: false });

  // touch: 1 finger orbits, 2 fingers pinch-zoom + pan
  let tPrev = null;
  cv.addEventListener('touchstart', e => {
    if (e.touches.length === 1) tPrev = { x: e.touches[0].clientX, y: e.touches[0].clientY, d: 0 };
    else if (e.touches.length === 2) {
      const a = e.touches[0], b = e.touches[1];
      tPrev = {
        x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2,
        d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      };
    }
    e.preventDefault();
  }, { passive: false });
  cv.addEventListener('touchmove', e => {
    if (!tPrev) return;
    if (e.touches.length === 1 && tPrev.d === 0) {
      const t0 = e.touches[0];
      view.yaw -= (t0.clientX - tPrev.x) * 0.006;
      view.pitch = clamp(view.pitch + (t0.clientY - tPrev.y) * 0.006, 0.03, 1.5);
      tPrev.x = t0.clientX; tPrev.y = t0.clientY;
    } else if (e.touches.length === 2) {
      const a = e.touches[0], b = e.touches[1];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (tPrev.d > 0) view.distGoal = clamp(view.distGoal * (tPrev.d / d), 6, 900);
      const mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
      panBy(mx - tPrev.x, my - tPrev.y);
      tPrev.x = mx; tPrev.y = my; tPrev.d = d;
    }
    e.preventDefault();
  }, { passive: false });
  cv.addEventListener('touchend', () => { tPrev = null; });

  document.getElementById('toggle').addEventListener('click', function () {
    const hud = document.getElementById('hud');
    const stats = document.getElementById('stats');
    const hidden = hud.style.display === 'none';
    hud.style.display = hidden ? '' : 'none';
    stats.style.display = hidden ? '' : 'none';
    this.textContent = hidden ? 'hide UI' : 'show UI';
  });
  addEventListener('resize', onResize);
}

function panBy(dx, dy) {
  const dir = camDir();
  const fwd = dir.clone().negate();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
  if (right.lengthSq() > 1e-6) right.normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  const s = view.dist * 0.0016;
  view.target.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camPersp.aspect = w / Math.max(1, h);
  camPersp.updateProjectionMatrix();
}

/* ---------------- loader / HUD ---------------- */
function setProgress(p, label) {
  const fill = document.getElementById('lfill');
  if (fill) fill.style.width = (p * 100).toFixed(0) + '%';
  if (label) document.getElementById('lstatus').textContent = label;
}
const nextTick = () => new Promise(r => setTimeout(r, 0));

/* ---------------- build pipeline ---------------- */
async function main() {
  initScene();
  setupInput();
  updateCamera();

  setProgress(0.03, 'carving the floating island…');
  await nextTick();
  buildTerrain();

  setProgress(0.20, 'raising the castle…');
  await nextTick();
  buildCastle();

  setProgress(0.35, 'planting the grounds…');
  await nextTick();
  buildGrounds();

  setProgress(0.42, 'meshing voxels…');
  await nextTick();
  const m = await addChunkMeshes(voxelGroup,
    [MAT_SOLID, MAT_EMISSIVE, MAT_WATER, MAT_GLASS],
    f => setProgress(0.42 + f * 0.5, 'meshing voxels…'));
  triCount = m.tris;

  setProgress(0.93, 'drifting clouds…');
  await nextTick();
  buildClouds();

  setProgress(0.97, 'lighting lanterns…');
  await nextTick();
  addPointLights();

  setProgress(1, 'expecto patronum');
  window.hogwarts = { view, scene, get, PAL };
  await nextTick();
  document.getElementById('loader').classList.add('done');
  loop();
}

/* ---------------- render loop ---------------- */
let lastT = performance.now(), fpsN = 0, fpsT = 0, fpsShown = 0;
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.1) dt = 0.1;
  const t = now / 1000;

  applyKeys(dt);
  view.dist += (view.distGoal - view.dist) * Math.min(1, dt * 8);
  updateCamera();
  updateClouds(t, dt);
  updateFlyingCar(t, dt);
  flickerLights(t);
  updateMoonView();
  composer.render();

  fpsN++; fpsT += dt;
  if (fpsT >= 0.5) {
    fpsShown = Math.round(fpsN / fpsT);
    fpsN = 0; fpsT = 0;
    const el = document.getElementById('stats');
    if (el) el.textContent =
      fpsShown + ' fps · ' + triCount.toLocaleString('en-US') + ' tris · ' +
      (view.ortho ? 'isometric' : 'perspective') + (autoOrbit ? ' · orbit' : '');
  }
}

main();