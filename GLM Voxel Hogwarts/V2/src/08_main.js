/* ════════════════════════════════════════════════════════════════════
   08_main.js — camera controls, build pipeline, render loop
   ════════════════════════════════════════════════════════════════════ */

const view = {
  tx: CX + 4, ty: PLAT_Y - 4, tz: CZ + 4,
  yaw: 0.62, pitch: 0.6155, dist: 330, distGoal: 330,
  ortho: true
};
const RESET = { yaw: 0.62, pitch: 0.6155, dist: 330, distGoal: 330, tx: CX + 4, ty: PLAT_Y - 4, tz: CZ + 4 };
let autoOrbit = false, trisTotal = 0, fps = 60;

const keys = {};
const canvasEl = () => renderer.domElement;

function viewDir() {
  const cp = Math.cos(view.pitch);
  return [Math.sin(view.yaw) * cp, Math.sin(view.pitch), Math.cos(view.yaw) * cp];
}

function updateCamera() {
  const [dx, dy, dz] = viewDir();
  const aspect = innerWidth / innerHeight;
  if (view.ortho) {
    const halfH = view.dist * 0.42, halfW = halfH * aspect;
    camIso.left = -halfW; camIso.right = halfW;
    camIso.top = halfH; camIso.bottom = -halfH;
    camIso.position.set(view.tx + dx * 1500, view.ty + dy * 1500, view.tz + dz * 1500);
    camIso.up.set(0, 1, 0);
    camIso.lookAt(view.tx, view.ty, view.tz);
    camIso.updateProjectionMatrix();
    rPass.camera = camIso;
  } else {
    camPer.aspect = aspect;
    camPer.position.set(view.tx + dx * view.dist, view.ty + dy * view.dist, view.tz + dz * view.dist);
    camPer.lookAt(view.tx, view.ty, view.tz);
    camPer.updateProjectionMatrix();
    rPass.camera = camPer;
  }
}

/* ── input ── */
function applyKeys(dt) {
  const K = (...cs) => cs.some(c => keys[c]);
  const shift = K('ShiftLeft', 'ShiftRight');
  const spd = Math.max(12, view.dist * 0.75) * (shift ? 3 : 1) * dt;
  const [dx, dy, dz] = viewDir();
  const fwd = view.ortho ? [-Math.sin(view.yaw), 0, -Math.cos(view.yaw)] : [-dx, -dy, -dz];
  const rx = Math.cos(view.yaw), rz = -Math.sin(view.yaw);
  if (K('KeyW')) { view.tx += fwd[0] * spd; view.ty += fwd[1] * spd; view.tz += fwd[2] * spd; }
  if (K('KeyS')) { view.tx -= fwd[0] * spd; view.ty -= fwd[1] * spd; view.tz -= fwd[2] * spd; }
  if (K('KeyA')) { view.tx -= rx * spd; view.tz -= rz * spd; }
  if (K('KeyD')) { view.tx += rx * spd; view.tz += rz * spd; }
  if (K('KeyR', 'Space')) view.ty += spd;
  if (K('KeyF', 'KeyC')) view.ty -= spd;
  if (K('KeyQ')) view.yaw += 0.9 * dt;
  if (K('KeyE')) view.yaw -= 0.9 * dt;
  if (K('ArrowLeft')) view.yaw += 0.9 * dt;
  if (K('ArrowRight')) view.yaw -= 0.9 * dt;
  if (K('ArrowUp')) view.pitch = clamp(view.pitch + 0.55 * dt, 0.03, 1.5);
  if (K('ArrowDown')) view.pitch = clamp(view.pitch - 0.55 * dt, 0.03, 1.5);
  const zf = K('Equal', 'NumpadAdd', 'PageUp', 'KeyZ') ? 1 : 0,
        zo = K('Minus', 'NumpadSubtract', 'PageDown', 'KeyX') ? 1 : 0;
  if (zf) view.distGoal = clamp(view.distGoal * Math.exp(1.1 * dt), 6, 900);
  if (zo) view.distGoal = clamp(view.distGoal / Math.exp(1.1 * dt), 6, 900);
  view.tx = clamp(view.tx, -400, W + 400);
  view.tz = clamp(view.tz, -400, D + 400);
  view.ty = clamp(view.ty, -200, 700);
}

function bindInput() {
  const el = canvasEl();
  addEventListener('keydown', e => {
    if (e.code === 'KeyP') { view.ortho = !view.ortho; updateStats(); }
    else if (e.code === 'KeyT') autoOrbit = !autoOrbit;
    else if (e.code === 'KeyH') document.getElementById('help').classList.toggle('packed');
    else if (e.code === 'Digit0' || e.code === 'Home') { Object.assign(view, RESET); setMode(true); }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(e.code))
      e.preventDefault();
    keys[e.code] = true;
  });
  addEventListener('keyup', e => keys[e.code] = false);
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  el.addEventListener('wheel', e => {
    e.preventDefault();
    view.distGoal = clamp(view.distGoal * Math.pow(1.0016, e.deltaY), 6, 900);
  }, { passive: false });

  const pts = new Map();
  let panMode = false, last = null;
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    panMode = e.button !== 0 || e.shiftKey;
    if (pts.size === 2) panMode = true;
    last = { x: e.clientX, y: e.clientY };
    el.style.cursor = 'grabbing';
  });
  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size >= 2) {                                  /* pinch zoom + pan */
      const ids = [...pts.keys()], a = pts.get(ids[0]), b = pts.get(ids[1]);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchD) view.distGoal = clamp(view.distGoal * pinchD / d, 6, 900);
      pinchD = d;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (lastP) pan(mx - lastP.x, my - lastP.y);
      lastP = { x: mx, y: my };
      return;
    }
    const dx2 = e.clientX - last.x, dy2 = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    if (panMode) pan(dx2, dy2);
    else {
      view.yaw -= dx2 * 0.0052;
      view.pitch = clamp(view.pitch + dy2 * 0.0045, 0.03, 1.5);
    }
  });
  let pinchD = 0, lastP = null;
  const end = e => {
    pts.delete(e.pointerId);
    if (pts.size < 2) { pinchD = 0; lastP = null; }
    if (pts.size === 0) { el.style.cursor = 'grab'; panMode = false; }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.style.cursor = 'grab';

  function pan(dx2, dy2) {
    const s = view.dist * 0.0016;
    const [dx3, dy3, dz3] = viewDir();
    const fx = -dx3, fyv = -dy3, fz = -dz3;
    let rx2 = -fz, rz2 = fx; const rl = Math.hypot(rx2, rz2) || 1; rx2 /= rl; rz2 /= rl;
    const ux2 = -rz2 * fyv, uy2 = rz2 * fx - rx2 * fz, uz2 = rx2 * fyv;
    view.tx += (ux2 * dy2 - rx2 * dx2) * s;
    view.ty += uy2 * dy2 * s;
    view.tz += (uz2 * dy2 - rz2 * dx2) * s;
  }
}

/* ── loader helpers ── */
function setProgress(frac, msg) {
  document.getElementById('fill').style.width = Math.round(frac * 100) + '%';
  if (msg) document.getElementById('lstep').textContent = msg;
}
const tickIO = () => new Promise(r => {          /* unthrottled by background tabs */
  const ch = new MessageChannel();
  ch.port1.onmessage = () => { ch.port1.close(); r(); };
  ch.port2.postMessage(0);
});

/* ── stats & debug hooks ── */
function updateStats() {
  document.getElementById('stats').textContent =
    `${fps | 0} fps · ${(trisTotal / 1000 | 0)}k tris · ${view.ortho ? 'isometric' : 'perspective'}`;
}

window.__cam = o => {
  if (o) {
    if ('az' in o) view.yaw = +o.az;
    if ('el' in o) view.pitch = +o.el;
    if ('dist' in o) { view.dist = +o.dist; view.distGoal = +o.dist; }
    if ('tx' in o) view.tx = +o.tx;
    if ('ty' in o) view.ty = +o.ty;
    if ('tz' in o) view.tz = +o.tz;
    if ('ortho' in o) view.ortho = !!o.ortho;
    updateCamera();
  }
  return { az: view.yaw, el: view.pitch, dist: view.dist,
           tx: view.tx, ty: view.ty, tz: view.tz, ortho: view.ortho };
};
window.__stats = {};
window.hogwarts = { get view() { return view; }, scene: () => scene, get, PAL };

/* ── build pipeline ── */
function setMode(orthoMode) { view.ortho = orthoMode; }

async function main() {
  const fail = e => {
    console.error(e);
    const box = document.getElementById('lerr');
    box.style.display = 'block';
    box.textContent = 'Error: ' + (e && (e.stack || e.message || e));
  };
  self.addEventListener('error', e => fail(e.error || e.message));
  self.addEventListener('unhandledrejection', e => fail(e.reason));

  try {
    sceneInit();
    await tickIO();

    setProgress(0.05, 'raising the island…');
    buildTerrain();
    await tickIO();

    setProgress(0.14, 'laying the castle walls…');
    buildCastle();
    await tickIO();

    setProgress(0.3, 'growing the grounds…');
    buildGrounds();
    await tickIO();

    setProgress(0.36, 'carving 200,000 faces…');
    const nCh = NXC * NYCH * NZC; let done = 0;
    trisTotal = await buildChunkMeshes(scene, () => {
      done++;
      setProgress(0.36 + 0.5 * done / nCh, `carving faces… ${(done / nCh * 100 | 0)}%`);
    }, tickIO);
    if (facesDropped) console.warn('mesh overflow: ' + facesDropped + ' faces dropped');

    setProgress(0.9, 'hanging the clouds…');
    buildPointLights();
    await tickIO();

    setProgress(1, 'waking the night…');
    updateCamera();
    updateMoon();
    await tickIO();

    addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight);
      composer.setSize(innerWidth, innerHeight);
      bloomPass.setSize(innerWidth, innerHeight);
    });

    bindInput();
    let last = performance.now(), tAcc = 0, statT = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      tAcc += dt;
      fps = fps * 0.94 + (1 / Math.max(dt, 1e-4)) * 0.06;
      applyKeys(dt);
      if (autoOrbit) view.yaw += 0.22 * dt;
      view.dist += (view.distGoal - view.dist) * Math.min(1, dt * 7);
      updateCamera();
      updateClouds(tAcc, dt);
      updateFlyingCar(tAcc, dt);
      updateMoon();
      updateLights(tAcc);
      composer.render();
      statT += dt;
      if (statT > 0.5) {
        statT = 0;
        updateStats();
        Object.assign(window.__stats, { fps, tris: trisTotal, mode: view.ortho ? 'iso' : 'persp',
                                        dist: view.dist, dropped: facesDropped,
                                        drawn: renderer.info.render.triangles,
                                        calls: renderer.info.render.calls });
      }
    }
    requestAnimationFrame(loop);

    const ld = document.getElementById('loader');
    ld.style.opacity = '0';
    setTimeout(() => ld.style.display = 'none', 900);
    setTimeout(() => { document.getElementById('hint').style.opacity = '0'; }, 7000);
  } catch (e) { fail(e); }
}

main();
