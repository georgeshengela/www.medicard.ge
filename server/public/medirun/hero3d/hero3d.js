// MEDIRUN /medirun hero (owner 2026-10-08): the key-art city as a floating 3D diorama (Meshy model from the poster).
// It grows out of its slab, sits dark, then a mint runner runs the street and lights the houses behind it; at the end
// the whole block lights up, dims, and the runner goes again. The poster <picture> stays as the fallback (no WebGL2,
// reduced motion, load error) and as the first paint. Model + path come from brand/medirun/hero3d (build.mjs).
import * as THREE from 'three';
import { GLTFLoader } from '/vendor/three/GLTFLoader.js';
import { MeshoptDecoder } from '/vendor/three/meshopt_decoder.module.js';

const BASE = '/medirun/hero3d/';
const V = '2';
const ADD = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };

const hero = document.querySelector('.hero');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
// ?lite=1 — the app's lobby (owner 2026-10-09: the phone got hot): 30 fps, a lower resolution, and after two laps the
// city rests on its fully lit frame instead of rendering forever. The /medirun page never passes it.
const LITE = params.get('lite') === '1';
if (hero && !reduce && params.get('3d') !== '0') start().catch((e) => console.warn('hero3d', e));

async function start() {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-3d';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return;
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const [cityGltf, runnerGltf, path] = await Promise.all([
    loader.loadAsync(BASE + (params.get('city') || 'city') + '.glb?v=' + V),
    loader.loadAsync('/medirun/glow/runner-m.glb'),
    fetch(BASE + 'path.json?v=' + V).then((r) => r.json()),
  ]);

  // ---- City: one baked-texture mesh, normalised so the block is 10 units wide with the street level at y = 0.
  const scene = new THREE.Scene();
  const world = new THREE.Group();
  scene.add(world);
  const norm = new THREE.Matrix4().fromArray(path.matrix);
  const pts = path.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const segLen = [0];
  for (let i = 1; i < pts.length; i++) segLen.push(segLen[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = segLen[segLen.length - 1];
  const end = pts[pts.length - 1];

  const uniforms = {
    map: { value: null }, uGrow: { value: 0 }, uRun: { value: 0 }, uFinale: { value: 0 }, uFade: { value: 1 },
    uAlpha: { value: 0 }, uRunner: { value: new THREE.Vector3(0, -99, 0) }, uEnd: { value: end.clone() },
    uDbg: { value: +(params.get('dbg') || 0) }, uReach: { value: path.reach || 1.1 }, uSpan: { value: path.span || 9 }, uTime: { value: 0 },
  };
  let cityMesh = null;
  cityGltf.scene.updateMatrixWorld(true);
  cityGltf.scene.traverse((o) => {
    if (!o.isMesh || cityMesh) return;
    const src = o.geometry;
    const n = src.attributes.position.count;
    const pos = new Float32Array(n * 3);
    const m = new THREE.Matrix4().multiplyMatrices(norm, o.matrixWorld);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(src.attributes.position, i).applyMatrix4(m); pos.set([v.x, v.y, v.z], i * 3); }
    const uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { uv[i * 2] = src.attributes.uv.getX(i); uv[i * 2 + 1] = src.attributes.uv.getY(i); }
    const nor = new Float32Array(n * 3);
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(src.attributes.normal, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (src.index) g.setIndex(src.index.clone());
    g.setAttribute('aP', new THREE.BufferAttribute(pathAttrib(pos, pts, segLen, total), 3));
    g.setAttribute('aRough', new THREE.BufferAttribute(roughness(nor, g.index), 1));
    g.computeBoundingSphere();
    uniforms.map.value = o.material.map;
    if (o.material.map) o.material.map.anisotropy = 4;
    cityMesh = new THREE.Mesh(g, cityMaterial(uniforms));
  });
  if (!cityMesh || !uniforms.map.value) return;   // no texture (blocked fetch) → keep the poster
  world.add(cityMesh);

  // Soft light pool under the floating block.
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.ShaderMaterial({
    ...ADD, uniforms: { uA: uniforms.uAlpha, uF: uniforms.uFinale },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float uA, uF; void main(){ float d = length(vUv - .5) * 2.; float a = pow(max(0., 1. - d), 2.2); vec3 c = vec3(.05, .22, .24) * a * uA * (.55 + .45 * uF); gl_FragColor = vec4(c, max(c.r, max(c.g, c.b))); }',
  }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = path.bottom - 0.6;
  world.add(pool);

  // ---- Trail: a mint ribbon on the street, revealed up to the runner.
  const trail = new THREE.Mesh(ribbon(pts, segLen, total, path.width || 0.2), new THREE.ShaderMaterial({
    ...ADD, uniforms,
    vertexShader: `attribute vec2 aR; varying vec2 vR; void main(){ vR = aR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vR; uniform float uRun, uFade, uFinale, uTime;
      void main(){
        float ahead = vR.x - uRun;
        if (ahead > 0.0) discard;
        float side = abs(vR.y);
        float core = pow(1.0 - side, 3.0);
        float head = exp(ahead * 60.0);
        float pulse = 0.5 + 0.5 * sin(vR.x * 90.0 - uTime * 6.0);
        vec3 c = vec3(0.10, 0.85, 0.62) * (0.35 + 0.9 * core + 0.3 * pulse * core) + vec3(0.7, 1.0, 0.9) * head * core * 1.6;
        c *= smoothstep(1.0, 0.75, side) * uFade;
        gl_FragColor = vec4(c, min(1.0, max(c.r, max(c.g, c.b))));
      }`,
  }));
  trail.renderOrder = 2;
  world.add(trail);

  // ---- Runner: the app's approved MEDIRUN runner, as a glowing mint silhouette.
  const runner = runnerGltf.scene;
  const mint = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 2.1, 1.75), transparent: true, opacity: 0 });
  runner.traverse((o) => { if (o.isMesh) { o.material = mint; o.frustumCulled = false; } });
  const rb = new THREE.Box3().setFromObject(runner);
  const runnerScale = (path.runner || 0.55) / Math.max(0.001, rb.max.y - rb.min.y);
  runner.scale.setScalar(runnerScale);
  world.add(runner);
  const mixer = new THREE.AnimationMixer(runner);
  const clip = (name) => mixer.clipAction(runnerGltf.animations.find((a) => a.name === name) || runnerGltf.animations[0]);
  const runAct = clip('run'), danceAct = clip('dance');
  runAct.play();

  // ---- Sparks thrown up by the runner's feet.
  const SPARKS = 160;
  const sp = { pos: new Float32Array(SPARKS * 3), vel: new Float32Array(SPARKS * 3), life: new Float32Array(SPARKS), next: 0 };
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp.pos, 3));
  sparkGeo.setAttribute('aLife', new THREE.BufferAttribute(sp.life, 1));
  const sparks = new THREE.Points(sparkGeo, new THREE.ShaderMaterial({
    ...ADD, uniforms: { uPx: { value: 1 } },
    vertexShader: `attribute float aLife; varying float vL; uniform float uPx;
      void main(){ vL = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (2.0 + 5.0 * aLife) * (18.0 / -mv.z); }`,
    fragmentShader: `varying float vL; void main(){ float d = length(gl_PointCoord - .5); if (vL <= 0.0 || d > .5) discard; vec3 c = mix(vec3(1.0, .75, .35), vec3(.4, 1.0, .85), vL) * (1.0 - d * 2.0) * vL * 2.2; gl_FragColor = vec4(c, min(1.0, max(c.r, max(c.g, c.b)))); }`,
  }));
  sparks.frustumCulled = false;
  world.add(sparks);

  // ---- Camera + layout.
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 400);
  const look = new THREE.Vector3(path.center[0], path.center[1], path.center[2]);
  const radius = path.radius || 7.5;
  const view = { az: path.azimuth ?? 0, el: path.elevation ?? 0.62, ptrX: 0, ptrY: 0, x: 0, y: 0 };
  let W = 1, H = 1;
  const post = createPost(renderer);
  function layout() {
    const r = hero.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    // Wide screens: the block floats upper-right of the copy, canvas = whole hero. Narrow ones: the hero reserves a band
    // above the copy (medirun.css padding-top) and the canvas covers only that band.
    const narrow = W < 1080;
    const pt = parseFloat(getComputedStyle(hero).paddingTop) || 120;
    const CH = narrow ? Math.min(H, Math.round(pt + W * 0.1)) : H;
    canvas.style.height = CH + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, LITE ? 1.25 : narrow ? 1.75 : 2) * quality;
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, CH, false);
    post.resize(Math.round(W * dpr), Math.round(CH * dpr));
    sparks.material.uniforms.uPx.value = dpr;
    const cx = narrow ? W / 2 : 0.64 * W, cy = narrow ? 60 + (pt - 60) * 0.5 : 0.42 * H;
    const S = narrow ? Math.min(W * 0.94, (pt - 60) * 1.3) : 0.98 * Math.min(H, W * 0.75);   // block size on screen, px
    camera.aspect = W / CH;
    camera.userData.dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(0.2, S / CH) * 0.92;
    camera.setViewOffset(W, CH, W / 2 - cx, CH / 2 - cy, W, CH);
    camera.updateProjectionMatrix();
  }
  let quality = 1;

  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    view.ptrX = (e.clientX - r.left) / r.width - 0.5; view.ptrY = (e.clientY - r.top) / r.height - 0.5;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { view.ptrX = 0; view.ptrY = 0; }, { passive: true });

  // ---- Timeline.
  const RUN = Math.max(8, Math.min(14, total * 0.75));
  const T = { rise: 0.9, grow: [0.3, 3.0], runAt: 3.2, finale: 2.4, hold: 4.5, dim: 1.6 };
  let t0 = null, lapStart = T.runAt, last = 0, running = true, visible = true, slow = 0, laps = 0, rested = false, drawn = 0;
  const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const tmp = new THREE.Vector3(), tan = new THREE.Vector3();

  function at(s, out) {
    const d = s * total;
    let i = 1;
    while (i < segLen.length - 1 && segLen[i] < d) i++;
    const k = (d - segLen[i - 1]) / Math.max(1e-6, segLen[i] - segLen[i - 1]);
    out.lerpVectors(pts[i - 1], pts[i], Math.min(1, Math.max(0, k)));
    tan.subVectors(pts[i], pts[i - 1]).setY(0).normalize();
    return out;
  }

  function update(now) {
    if (t0 === null) t0 = now;
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    uniforms.uTime.value = t;
    const rise = Math.min(1, t / T.rise);
    uniforms.uAlpha.value = rise;
    world.position.y = -1.6 * Math.pow(1 - rise, 3);
    uniforms.uGrow.value = Math.min(1, Math.max(0, (t - T.grow[0]) / (T.grow[1] - T.grow[0])));

    // One lap: run → light everything from the finish → hold → dim → again.
    const lap = t - lapStart;
    const runP = lap < 0 ? 0 : Math.min(1, lap / RUN);
    const fin = Math.min(1, Math.max(0, (lap - RUN) / T.finale));
    const dim = Math.min(1, Math.max(0, (lap - RUN - T.finale - T.hold) / T.dim));
    uniforms.uRun.value = lap < 0 ? -0.05 : easeInOut(runP) * 1.0;
    uniforms.uFinale.value = fin;
    uniforms.uFade.value = 1 - dim;
    if (dim >= 1) { laps++; lapStart = t + 0.6; runAct.reset().fadeIn(0.3).play(); danceAct.fadeOut(0.3); }
    if (LITE && laps >= 1 && fin >= 1 && dim === 0 && lap > RUN + T.finale + 1) rested = true;

    const show = lap < 0 ? 0 : Math.min(1, lap / 0.5) * (1 - Math.min(1, Math.max(0, (lap - RUN - T.finale - T.hold * 0.6) / 0.8)));
    mint.opacity = show;
    runner.visible = show > 0.01;
    at(Math.max(0, uniforms.uRun.value), tmp);
    runner.position.copy(tmp);
    if (runP < 1) runner.lookAt(tmp.x + tan.x, tmp.y, tmp.z + tan.z);
    uniforms.uRunner.value.copy(runner.visible ? tmp : tmp.set(0, -99, 0));
    if (runP >= 1 && !danceAct.isRunning()) { danceAct.reset().fadeIn(0.4).play(); runAct.fadeOut(0.4); }
    mixer.update(dt * (runP < 1 ? 1.15 : 1));

    // Sparks from the feet while running.
    if (runner.visible && runP > 0 && runP < 1) {
      for (let k = 0; k < 3; k++) {
        const i = sp.next; sp.next = (sp.next + 1) % SPARKS;
        sp.pos.set([runner.position.x + (Math.random() - 0.5) * 0.1, runner.position.y + 0.04, runner.position.z + (Math.random() - 0.5) * 0.1], i * 3);
        sp.vel.set([(Math.random() - 0.5) * 0.6 - tan.x * 0.4, 0.5 + Math.random() * 0.9, (Math.random() - 0.5) * 0.6 - tan.z * 0.4], i * 3);
        sp.life[i] = 1;
      }
    }
    for (let i = 0; i < SPARKS; i++) {
      if (sp.life[i] <= 0) continue;
      sp.life[i] -= dt * 1.1;
      sp.vel[i * 3 + 1] -= dt * 0.9;
      for (let a = 0; a < 3; a++) sp.pos[i * 3 + a] += sp.vel[i * 3 + a] * dt;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.aLife.needsUpdate = true;

    // Camera: slow sway, pointer parallax, a little lift as the hero scrolls away.
    view.x += (view.ptrX - view.x) * 0.04; view.y += (view.ptrY - view.y) * 0.04;
    const scroll = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / H));
    const az = view.az + Math.sin(t * 0.13) * 0.07 + view.x * 0.22;
    const el = view.el + Math.sin(t * 0.09) * 0.025 - view.y * 0.1 + scroll * 0.25;
    const dist = camera.userData.dist * (1 + 0.12 * Math.pow(1 - rise, 2));
    camera.position.set(look.x + Math.sin(az) * Math.cos(el) * dist, look.y + Math.sin(el) * dist, look.z + Math.cos(az) * Math.cos(el) * dist);
    camera.lookAt(look);
  }

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    if (LITE && now - drawn < 32) return;   // 30 fps is plenty for a background
    drawn = now;
    const a = performance.now();
    update(now);
    post.render(scene, camera);
    if (rested) { running = false; return; }   // keep the lit frame on screen, stop drawing
    // Phones that cannot keep up get a lower resolution once, then the bloom off.
    const ms = performance.now() - a;
    slow = ms > 28 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 90) { slow = 0; if (quality > 0.7) { quality = 0.7; layout(); } else post.bloom = false; }
  }

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }, { threshold: 0 });
  io.observe(hero);
  document.addEventListener('visibilitychange', wake);
  function wake() {
    const on = visible && !document.hidden;
    if (on && !running && !rested) { running = true; last = performance.now(); requestAnimationFrame(loop); }
    running = on;
  }

  hero.prepend(canvas);
  layout();
  window.addEventListener('resize', layout, { passive: true });
  renderer.compile(scene, camera);
  requestAnimationFrame((now) => { hero.classList.add('is-3d'); loop(now); });
  // Debug handle for the lab/screenshots: seek(seconds) jumps the timeline.
  window.__hero3d = { uniforms, camera, view, path, post, runner, trail, cityMesh, pool, sparks, seek: (s) => { t0 = performance.now() - s * 1000; } };
}

// Per vertex: the largest normal break to a neighbour (1 - cos). Meshy's raw houses are faceted (high), rock is smooth (low).
function roughness(nor, index) {
  const n = nor.length / 3, out = new Float32Array(n), idx = index ? index.array : null;
  const tris = idx ? idx.length / 3 : n / 3;
  const dev = (a, b) => {
    const d = 1 - (nor[a * 3] * nor[b * 3] + nor[a * 3 + 1] * nor[b * 3 + 1] + nor[a * 3 + 2] * nor[b * 3 + 2]);
    if (d > out[a]) out[a] = d;
    if (d > out[b]) out[b] = d;
  };
  for (let t = 0; t < tris; t++) {
    const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
    dev(a, b); dev(b, c); dev(c, a);
  }
  return out;
}

// Per vertex: x = nearest street position along the run (0..1), y = distance to the street, z = grow delay.
function pathAttrib(pos, pts, segLen, total) {
  const n = pos.length / 3, out = new Float32Array(n * 3);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) { const x = pos[i * 3], z = pos[i * 3 + 2]; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, R = Math.hypot(maxX - cx, maxZ - cz);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], z = pos[i * 3 + 2];
    let best = Infinity, bs = 0;
    for (let k = 1; k < pts.length; k++) {
      const ax = pts[k - 1].x, az = pts[k - 1].z, bx = pts[k].x - ax, bz = pts[k].z - az;
      const L2 = bx * bx + bz * bz || 1e-9;
      const u = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / L2));
      const dx = x - ax - bx * u, dz = z - az - bz * u, d = dx * dx + dz * dz;
      if (d < best) { best = d; bs = (segLen[k - 1] + u * (segLen[k] - segLen[k - 1])) / total; }
    }
    const radial = Math.hypot(x - cx, z - cz) / R;
    const wobble = 0.5 + 0.5 * Math.sin(x * 1.7 + 1.3) * Math.sin(z * 1.9 - 0.7);
    out[i * 3] = bs; out[i * 3 + 1] = Math.sqrt(best); out[i * 3 + 2] = Math.min(1, radial * 0.78 + wobble * 0.22);
  }
  return out;
}

function ribbon(pts, segLen, total, width) {
  const n = pts.length, pos = new Float32Array(n * 6), r = new Float32Array(n * 4), idx = [];
  const dir = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    dir.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).setY(0).normalize();
    const nx = -dir.z * width / 2, nz = dir.x * width / 2, y = pts[i].y + 0.025;
    pos.set([pts[i].x + nx, y, pts[i].z + nz, pts[i].x - nx, y, pts[i].z - nz], i * 6);
    r.set([segLen[i] / total, -1, segLen[i] / total, 1], i * 4);
    if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aR', new THREE.BufferAttribute(r, 2));
  g.setIndex(idx);
  return g;
}

function cityMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms, transparent: true,
    vertexShader: `
      attribute vec3 aP; attribute float aRough;
      uniform float uGrow, uRun, uFinale, uFade, uReach, uSpan;
      uniform vec3 uRunner, uEnd;
      varying vec2 vUv; varying float vLit, vEdge, vGlow, vH, vRough; varying vec3 vN, vW;
      void main(){
        vUv = uv;
        vRough = aRough;
        vN = normal;
        vec3 p = position;
        float h = max(p.y, 0.0);
        float g = clamp((uGrow - aP.z * 0.72) / 0.28, 0.0, 1.0);
        float e = 1.0 - pow(1.0 - g, 3.0);
        e += 0.07 * sin(g * 3.14159) * step(g, 0.999);
        p.y = min(p.y, 0.0) + h * e;
        vH = h;
        vW = position;
        vEdge = h > 0.03 ? 1.0 - g : 0.0;
        float passed = smoothstep(0.0, 0.035, uRun - aP.x);
        float near = 1.0 - smoothstep(uReach * 0.45, uReach, aP.y);
        float R = uFinale * uSpan * 1.25;
        float fin = 1.0 - smoothstep(R - 2.2, R, distance(p.xz, uEnd.xz));
        vLit = max(passed * near, fin * step(0.001, uFinale)) * uFade;
        vGlow = exp(-pow(distance(p, uRunner) / 0.4, 2.0));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float uAlpha, uTime, uDbg;
      varying vec2 vUv; varying float vLit, vEdge, vGlow, vH, vRough; varying vec3 vN, vW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec3 tex = texture2D(map, vUv).rgb;
        vec3 soft = texture2D(map, vUv, 3.5).rgb;           // blurred sample gates every material guess (no per-pixel speckles)
        float lum = dot(tex, vec3(0.2126, 0.7152, 0.0722));
        float slum = dot(soft, vec3(0.2126, 0.7152, 0.0722));
        vec3 nrm = normalize(vN);
        float moon = max(dot(nrm, normalize(vec3(-0.45, 0.8, 0.35))), 0.0);   // cool moonlight from the river side
        float up = clamp(nrm.y, 0.0, 1.0);
        float wall = 1.0 - smoothstep(0.35, 0.7, abs(nrm.y));
        // Graded albedo: the Meshy texture is flat and grey, so give it contrast and colour back.
        vec3 alb = mix(vec3(lum), tex, 1.35);
        alb = max(alb, 0.0) * (0.7 + 1.6 * lum);
        float warm = clamp((soft.r - soft.b) * 2.6 - 0.02, 0.0, 1.0);
        float mintT = clamp((soft.g - soft.r) * 3.0 - 0.15, 0.0, 1.0);
        // Water: flat, low, the only light blue-grey flat surface (streets are dark, lit roofs are orange).
        float water = smoothstep(0.93, 0.98, nrm.y) * step(vH, 0.3) * smoothstep(0.045, 0.07, slum) * smoothstep(-0.002, 0.008, soft.b - soft.r) * (1.0 - mintT);
        // Night: deep blue city, moonlit tops, a faint sky bounce.
        vec3 night = alb * vec3(0.42, 0.55, 0.95) * (0.45 + 0.75 * moon) + vec3(0.004, 0.009, 0.024) * (0.4 + up);
        night *= 1.0 - mintT * 0.65;   // the painted street waits dark for the runner
        night = night / (1.0 + night * 1.6);
        float n = hash(floor(vUv * 220.0));
        float l = smoothstep(n * 0.55, n * 0.55 + 0.45, vLit);   // houses switch on window by window
        // Lit: facades catch warm street light from below; roofs stay cool with a warm rim.
        float low = smoothstep(1.3, 0.0, vH);
        vec3 facade = alb * vec3(2.3, 1.3, 0.66) * (0.75 + 0.75 * low);
        vec3 roof = alb * vec3(0.62, 0.72, 1.05) * (0.6 + 0.6 * moon) + vec3(0.05, 0.025, 0.008) * low * (1.0 - up * 0.7);
        vec3 lit = mix(roof, facade, wall);
        lit += alb * warm * vec3(2.2, 1.2, 0.5);
        lit = mix(lit, vec3(0.08, 0.75, 0.56) * (0.6 + lum), mintT * 0.85);   // the painted street turns mint, not white
        // Windows: a lit grid on the walls, each window switching on at its own moment.
        vec2 tdir = normalize(vec2(-nrm.z, nrm.x) + 1e-5);
        vec2 wp = vec2(dot(vW.xz, tdir) / 0.11, vW.y / 0.15);
        vec2 cell = floor(wp), f = fract(wp);
        float hw = hash(cell + floor(vW.xz * 0.7) * 17.0);
        float pane = step(0.3, f.x) * step(f.x, 0.72) * step(0.28, f.y) * step(f.y, 0.78);
        float on = step(0.42, hw) * smoothstep(hw * 0.6, hw * 0.6 + 0.2, vLit);
        // Meshy's raw houses are faceted, its rock and trees are smoothly sculpted: windows only on faceted walls.
        float rough = 1.0 - smoothstep(0.1, 0.2, vRough);
        float win = wall * pane * on * step(0.06, vH) * step(vH, 1.9) * (1.0 - rough);
        vec3 wc = mix(vec3(1.0, 0.62, 0.28), vec3(1.0, 0.85, 0.6), fract(hw * 7.3));
        lit += wc * win * (1.1 + 0.5 * fract(hw * 13.1));
        vec3 col = mix(night, lit, l);
        // River: dark glassy water with moving glints; warm streaks once the city around it is lit.
        float wave = sin(vW.z * 26.0 + 2.2 * sin(vW.x * 1.7 + uTime * 0.35) + uTime * 1.1);
        float dash = smoothstep(0.2, 0.9, sin(vW.x * 4.3 - uTime * 0.6 + 3.0 * sin(vW.z * 1.3)) * 0.5 + 0.5);
        float glint = smoothstep(0.86, 0.99, wave) * dash;
        vec3 waterC = vec3(0.006, 0.014, 0.032) + vec3(0.05, 0.09, 0.16) * glint * 0.5 + vec3(1.0, 0.55, 0.22) * glint * l * 0.4;
        col = mix(col, waterC, water);
        // Growing in: mint holographic scan lines until the house sets.
        float scan = 0.35 + 0.65 * step(0.55, fract(vW.y * 9.0 - uTime * 0.8));
        col = mix(col, vec3(0.06, 0.55, 0.45) * scan, min(1.0, vEdge * 1.2) * 0.85);
        col += vec3(0.35, 1.0, 0.85) * vGlow * 0.4;
        if (uDbg > 0.5) col = uDbg < 1.5 ? vec3(smoothstep(0.045, 0.07, slum), 1.0 - smoothstep(0.004, 0.02, soft.b - soft.r), step(vH, 0.08)) : uDbg < 2.5 ? tex : uDbg < 3.5 ? vec3(water) : vec3(rough, vRough * 4.0, 0.0);
        gl_FragColor = vec4(col * uAlpha, uAlpha);
      }`,
  });
}

// Bloom with a transparent background: scene → bright pass → blur (½, ¼) → scene + glow, alpha = max(scene, glow).
function createPost(renderer) {
  const type = THREE.HalfFloatType;
  const mk = (s) => new THREE.WebGLRenderTarget(1, 1, { type, samples: s || 0, depthBuffer: !!s });
  const rs = mk(4), a = mk(), b = mk(), c = mk(), d = mk();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const fsScene = new THREE.Scene(); fsScene.add(quad);
  const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const bright = new THREE.ShaderMaterial({ uniforms: { t: { value: null } }, vertexShader: vs,
    fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb; float m = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(0.55, 1.2, m), 1.0); }' });
  const blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: vs,
    fragmentShader: `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
      void main(){ vec3 s = texture2D(t, vUv).rgb * 0.2270;
        s += (texture2D(t, vUv + dir * 1.3846).rgb + texture2D(t, vUv - dir * 1.3846).rgb) * 0.3162;
        s += (texture2D(t, vUv + dir * 3.2308).rgb + texture2D(t, vUv - dir * 3.2308).rgb) * 0.0703;
        gl_FragColor = vec4(s, 1.0); }` });
  const copy = new THREE.ShaderMaterial({ uniforms: { t: { value: null } }, vertexShader: vs,
    fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, 1.0); }' });
  const comp = new THREE.ShaderMaterial({ uniforms: { s: { value: null }, b1: { value: null }, b2: { value: null }, on: { value: 1 } }, vertexShader: vs,
    fragmentShader: `uniform sampler2D s, b1, b2; uniform float on; varying vec2 vUv;
      vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main(){
        vec4 sc = texture2D(s, vUv);
        vec3 g = (texture2D(b1, vUv).rgb * 0.8 + texture2D(b2, vUv).rgb * 0.9) * on;
        vec3 c = sc.rgb + g;
        c = c / (1.0 + max(c - 1.0, 0.0) * 0.6);               // soft shoulder for the brightest light
        float al = clamp(max(sc.a, max(g.r, max(g.g, g.b)) * 0.9), 0.0, 1.0);
        // premultiplied out: colour stays added light over the page
        gl_FragColor = vec4(toSRGB(c), al);
      }` });
  comp.blending = THREE.NoBlending; comp.transparent = true;
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.clear(); renderer.render(fsScene, cam); };
  let w = 1, h = 1;
  return {
    bloom: true,
    resize(W, H) { w = W; h = H; rs.setSize(W, H); a.setSize(W >> 1, H >> 1); b.setSize(W >> 1, H >> 1); c.setSize(W >> 2, H >> 2); d.setSize(W >> 2, H >> 2); },
    render(scene, camera) {
      renderer.setRenderTarget(rs); renderer.setClearColor(0, 0); renderer.clear(); renderer.render(scene, camera);
      if (this.bloom) {
        bright.uniforms.t.value = rs.texture; pass(bright, a);
        blur.uniforms.t.value = a.texture; blur.uniforms.dir.value.set(2 / w, 0); pass(blur, b);
        blur.uniforms.t.value = b.texture; blur.uniforms.dir.value.set(0, 2 / h); pass(blur, a);
        copy.uniforms.t.value = a.texture; pass(copy, c);
        blur.uniforms.t.value = c.texture; blur.uniforms.dir.value.set(4 / w, 0); pass(blur, d);
        blur.uniforms.t.value = d.texture; blur.uniforms.dir.value.set(0, 4 / h); pass(blur, c);
      }
      comp.uniforms.s.value = rs.texture; comp.uniforms.b1.value = a.texture; comp.uniforms.b2.value = c.texture; comp.uniforms.on.value = this.bloom ? 1 : 0;
      pass(comp, null);
    },
  };
}
