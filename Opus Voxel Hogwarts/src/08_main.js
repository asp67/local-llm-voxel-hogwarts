
// ============================================================================
// 11. CAMERA CONTROLS — WASD / mouse / wheel / touch, isometric or perspective
// ============================================================================
const DEFAULT_VIEW = { target: new THREE.Vector3(CX + 4, PLAT_Y - 4, CZ + 4), yaw: 0.62, pitch: 0.6155, dist: 330 };
const view = { target: DEFAULT_VIEW.target.clone(), yaw: DEFAULT_VIEW.yaw, pitch: DEFAULT_VIEW.pitch, dist: 330, distGoal: 330, ortho: true, auto: false };
const keys = new Set();
let activeCam = orthoCam;
window.hogwarts = { view, scene, get, PAL }; // handy for debugging from the console

function viewDir() {
  const cp = Math.cos(view.pitch);
  return new THREE.Vector3(Math.sin(view.yaw) * cp, Math.sin(view.pitch), Math.cos(view.yaw) * cp);
}
function updateCamera() {
  const dir = viewDir(), aspect = innerWidth / innerHeight;
  let halfH, depth;
  if (view.ortho) {
    halfH = view.dist * 0.42;
    Object.assign(orthoCam, { left: -halfH * aspect, right: halfH * aspect, top: halfH, bottom: -halfH });
    orthoCam.position.copy(view.target).addScaledVector(dir, 1500);
    orthoCam.lookAt(view.target); orthoCam.updateProjectionMatrix();
    activeCam = orthoCam; depth = 1500 + 1400;
  } else {
    perspCam.aspect = aspect; perspCam.updateProjectionMatrix();
    perspCam.position.copy(view.target).addScaledVector(dir, view.dist);
    perspCam.lookAt(view.target);
    activeCam = perspCam; depth = view.dist + 1400;
    halfH = Math.tan(THREE.MathUtils.degToRad(perspCam.fov / 2)) * depth;
  }
  renderPass.camera = activeCam;
  // Moon: project its fixed sky direction like a point at infinity. Perspective uses the real fov.
  // Orthographic has no vanishing point, so it uses a wide virtual sky fov (110°). Panning/zooming
  // leave it in place; rotating or tilting sweeps it across the sky.
  activeCam.updateMatrixWorld();
  const right = new THREE.Vector3().setFromMatrixColumn(activeCam.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(activeCam.matrixWorld, 1);
  const lz = -MOON_SKY.dot(dir);
  moonMesh.visible = lz > 0.05;
  if (moonMesh.visible) {
    const tanV = view.ortho ? Math.tan(THREE.MathUtils.degToRad(55)) : Math.tan(THREE.MathUtils.degToRad(perspCam.fov / 2));
    const ndcX = MOON_SKY.dot(right) / lz / (tanV * aspect), ndcY = MOON_SKY.dot(up) / lz / tanV;
    moonMesh.position.copy(view.target).addScaledVector(dir, -1400)
      .addScaledVector(up, ndcY * halfH).addScaledVector(right, ndcX * halfH * aspect);
    moonMesh.scale.setScalar(halfH / 300);
  }
}

function resetView() {
  view.target.copy(DEFAULT_VIEW.target); view.yaw = DEFAULT_VIEW.yaw; view.pitch = DEFAULT_VIEW.pitch; view.distGoal = DEFAULT_VIEW.dist;
}

const canvas = renderer.domElement;
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyP') { view.ortho = !view.ortho; if (!view.ortho) view.distGoal = Math.min(view.distGoal, 260), view.dist = view.distGoal; }
  if (e.code === 'KeyT') view.auto = !view.auto;
  if (e.code === 'Digit0' || e.code === 'Numpad0' || e.code === 'Home') resetView();
  if (e.code === 'KeyH') document.getElementById('hud').classList.toggle('min');
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
canvas.addEventListener('contextmenu', e => e.preventDefault());

const pointers = new Map();
let drag = null, pinch = null;
canvas.addEventListener('pointerdown', e => {
  canvas.focus(); canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; drag = null; }
  else drag = { mode: (e.button === 2 || e.button === 1 || e.shiftKey) ? 'pan' : 'orbit', x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    view.distGoal = THREE.MathUtils.clamp(view.distGoal * pinch.d / Math.max(1, d), 6, 900);
    panBy(mx - pinch.mx, my - pinch.my); Object.assign(pinch, { d, mx, my }); return;
  }
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if (drag.mode === 'orbit') { view.yaw -= dx * 0.005; view.pitch = THREE.MathUtils.clamp(view.pitch + dy * 0.004, 0.03, 1.5); }
  else panBy(dx, dy);
});
const endPtr = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (!pointers.size) drag = null; };
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { e.preventDefault(); view.distGoal = THREE.MathUtils.clamp(view.distGoal * Math.exp(e.deltaY * 0.0012), 6, 900); }, { passive: false });

function panBy(dx, dy) {
  const wpp = view.ortho ? (view.dist * 0.84) / innerHeight : (2 * view.dist * Math.tan(THREE.MathUtils.degToRad(perspCam.fov / 2))) / innerHeight;
  const right = new THREE.Vector3().setFromMatrixColumn(activeCam.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(activeCam.matrixWorld, 1);
  view.target.addScaledVector(right, -dx * wpp).addScaledVector(up, dy * wpp);
}

function applyKeys(dt) {
  const k = c => keys.has(c);
  const fast = (k('ShiftLeft') || k('ShiftRight')) ? 3 : 1;
  const speed = Math.max(12, view.dist * 0.75) * fast * dt;
  const fwd = view.ortho ? new THREE.Vector3(-Math.sin(view.yaw), 0, -Math.cos(view.yaw)) : viewDir().negate();
  const right = new THREE.Vector3(Math.cos(view.yaw), 0, -Math.sin(view.yaw));
  if (k('KeyW')) view.target.addScaledVector(fwd, speed);
  if (k('KeyS')) view.target.addScaledVector(fwd, -speed);
  if (k('KeyA')) view.target.addScaledVector(right, -speed);
  if (k('KeyD')) view.target.addScaledVector(right, speed);
  if (k('KeyR') || k('Space')) view.target.y += speed;
  if (k('KeyF') || k('KeyC')) view.target.y -= speed;
  if (k('KeyQ') || k('ArrowLeft')) view.yaw += 1.4 * dt;
  if (k('KeyE') || k('ArrowRight')) view.yaw -= 1.4 * dt;
  if (k('ArrowUp')) view.pitch = Math.min(1.5, view.pitch + 0.9 * dt);
  if (k('ArrowDown')) view.pitch = Math.max(0.03, view.pitch - 0.9 * dt);
  if (k('Equal') || k('NumpadAdd') || k('KeyZ') || k('PageUp')) view.distGoal = Math.max(6, view.distGoal * Math.exp(-1.6 * dt));
  if (k('Minus') || k('NumpadSubtract') || k('KeyX') || k('PageDown')) view.distGoal = Math.min(900, view.distGoal * Math.exp(1.6 * dt));
  if (view.auto) view.yaw += 0.07 * dt;
  view.dist += (view.distGoal - view.dist) * Math.min(1, dt * 10);
  view.target.x = THREE.MathUtils.clamp(view.target.x, -80, W + 80);
  view.target.z = THREE.MathUtils.clamp(view.target.z, -80, D + 80);
  view.target.y = THREE.MathUtils.clamp(view.target.y, -40, 240);
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth, innerHeight);
});

// ============================================================================
// 12. BUILD + LOOP
// ============================================================================
const stats = document.getElementById('stats');
let triCount = 0;
function loop() {
  let last = performance.now(), acc = 0, frames = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    applyKeys(dt); updateCamera();
    const t = now / 1000;
    cloudGroup.rotation.y += dt * 0.012;
    updateFlyingCar(t, dt);
    cloudGroup.children.forEach(c => c.position.y += Math.sin(t * 0.4 + c.userData.bob) * 0.01);
    for (const l of FLICKER) l.intensity = l.userData.base * (0.86 + 0.14 * Math.sin(t * 7.3 + l.userData.ph) * Math.sin(t * 3.1 + l.userData.ph * 2));
    composer.render();
    frames++; acc += dt;
    if (acc > 0.5) { stats.textContent = `${Math.round(frames / acc)} fps · ${(triCount / 1e6).toFixed(2)}M tris · ${view.ortho ? 'isometric' : 'perspective'}`; acc = 0; frames = 0; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

async function main() {
  const bar = document.querySelector('#bar i'), label = document.getElementById('stage');
  const stage = (txt, p) => { label.textContent = txt; bar.style.width = (p * 100).toFixed(1) + '%'; };
  try {
    const t0 = performance.now();
    stage('Raising the floating island…', 0.03); await tick();
    buildTerrain();
    stage('Laying the castle stones…', 0.2); await tick();
    buildCastle();
    stage('Planting the Forbidden Forest…', 0.38); await tick();
    buildGrounds();
    stage('Carving voxels…', 0.5); await tick();
    triCount = await addChunkMeshes(p => stage(`Carving voxels… ${Math.round(p * 100)}%`, 0.5 + p * 0.47));
    buildClouds(); addPointLights();
    updateCamera();
    stage('Mischief managed.', 1);
    console.log(`built in ${((performance.now() - t0) / 1000).toFixed(1)}s, ${triCount} triangles`);
    setTimeout(() => document.getElementById('loader').classList.add('done'), 250);
    canvas.focus();
    loop();
  } catch (err) {
    console.error(err); stage('Error: ' + err.message, 1);
  }
}
main();
