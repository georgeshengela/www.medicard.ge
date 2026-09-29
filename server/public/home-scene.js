/* MEDICARD front page — the 3D day.
   A phone carrying the app's real screens, circled by a 24-hour pulse ring whose heartbeat
   sits at the current moment. Scroll position comes from home.js (window.MedicardDay). */
import * as THREE from 'three';
import { RoomEnvironment } from '/vendor/three/RoomEnvironment.js';

const day = document.getElementById('day');
const canvas = document.getElementById('scene');
const S = window.MedicardDay;

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

if (day && canvas && S && webglOk()) start();

function start() {
  const reduced = S.reduced;
  const coarse = matchMedia('(pointer: coarse)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 13);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-4, 6, 8);
  scene.add(key);

  /* ───── Phone ───── */
  const SW = 1.5;                  // screen width
  const SH = SW * (1434 / 660);    // screen height, matches the screenshots
  const BW = SW + 0.13;
  const BH = SH + 0.13;
  const DEPTH = 0.12;
  const BEVEL = 0.045;

  function rounded(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  const phone = new THREE.Group();
  const bodyGeo = new THREE.ExtrudeGeometry(rounded(BW, BH, 0.26), {
    depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL,
    bevelSegments: 8, curveSegments: 32,
  });
  bodyGeo.translate(0, 0, -DEPTH / 2);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x080c0e, roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
  const titanium = new THREE.MeshPhysicalMaterial({ color: 0xc3ccca, roughness: 0.26, metalness: 1, envMapIntensity: 1.2 });
  const body = new THREE.Mesh(bodyGeo, [glass, titanium]);
  phone.add(body);

  // Side buttons
  const btnMat = titanium;
  [[BW / 2 + BEVEL, 0.75, 0.42], [-BW / 2 - BEVEL, 0.95, 0.26], [-BW / 2 - BEVEL, 0.45, 0.42]].forEach(([x, y, h]) => {
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, h, 4, 12), btnMat);
    b.position.set(x + Math.sign(x) * 0.008, y, 0);
    phone.add(b);
  });

  // Back camera plateau (seen when the phone turns)
  const cam = new THREE.Mesh(
    new THREE.ExtrudeGeometry(rounded(0.62, 0.62, 0.16), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 4, curveSegments: 16 }),
    new THREE.MeshPhysicalMaterial({ color: 0x1a2124, roughness: 0.3, metalness: 0.6, clearcoat: 1 }),
  );
  cam.rotation.y = Math.PI;
  cam.position.set(BW / 2 - 0.42, BH / 2 - 0.42, -DEPTH / 2 - BEVEL);
  phone.add(cam);

  // Screen: rounded, UVs mapped to the screenshot, scan-wipe between two textures
  const screenGeo = new THREE.ShapeGeometry(rounded(SW, SH, 0.2), 32);
  const pos = screenGeo.attributes.position;
  const uv = screenGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + SW / 2) / SW, (pos.getY(i) + SH / 2) / SH);

  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const blank = new THREE.DataTexture(new Uint8Array([238, 245, 244, 255]), 1, 1);
  blank.needsUpdate = true;
  const textures = S.keys.map(() => blank);

  // Each screen gets a real iOS status bar showing that moment's time, plus the Dynamic Island.
  function statusBar(g, w, time, dark) {
    const u = w / 440; // screenshots are 440 pt wide
    const ink = dark ? '#FFFFFF' : '#0B1215';
    g.fillStyle = ink;
    g.font = `600 ${17 * u}px FiraGO, -apple-system, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(time, 72 * u, 32 * u);
    // Dynamic Island
    g.fillStyle = '#000';
    const iw = 126 * u, ih = 37 * u, ix = (w - iw) / 2, iy = 11 * u;
    g.beginPath();
    g.roundRect(ix, iy, iw, ih, ih / 2);
    g.fill();
    // Signal
    g.fillStyle = ink;
    for (let b = 0; b < 4; b++) {
      const bh = (4 + b * 2.4) * u;
      g.beginPath();
      g.roundRect((326 + b * 5) * u, 37 * u - bh, 3.2 * u, bh, 0.8 * u);
      g.fill();
    }
    // Wi-Fi
    g.strokeStyle = ink;
    g.lineWidth = 2.1 * u;
    g.lineCap = 'round';
    for (let r = 0; r < 3; r++) {
      g.beginPath();
      g.arc(357 * u, 38 * u, (3 + r * 3.6) * u, -Math.PI * 0.75, -Math.PI * 0.25);
      g.stroke();
    }
    // Battery
    g.lineWidth = 1.1 * u;
    g.globalAlpha = 0.45;
    g.beginPath();
    g.roundRect(373 * u, 26.5 * u, 25 * u, 12 * u, 3.6 * u);
    g.stroke();
    g.globalAlpha = 1;
    g.beginPath();
    g.roundRect(375 * u, 28.5 * u, 18 * u, 8 * u, 2 * u);
    g.fill();
    g.globalAlpha = 0.45;
    g.beginPath();
    g.roundRect(399.5 * u, 30.5 * u, 1.6 * u, 4 * u, 0.8 * u);
    g.fill();
    g.globalAlpha = 1;
  }

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  S.keys.forEach((k, i) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = `/screens/v3/${k}.webp?v=1`;
    Promise.all([img.decode(), fontsReady]).then(() => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      statusBar(g, c.width, S.times[i], /-dark$/.test(k));
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, maxAniso);
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      textures[i] = tex;
    }).catch(() => {});
  });

  const screenMat = new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: blank },
      uB: { value: blank },
      uMix: { value: 0 },
      uSheen: { value: 0 },
      uDim: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uA;
      uniform sampler2D uB;
      uniform float uMix;
      uniform float uSheen;
      uniform float uDim;
      varying vec2 vUv;
      void main() {
        // The new screen scans in from the top, led by a thin teal line
        float scanning = step(0.001, uMix) * step(uMix, 0.999);
        float edge = 1.04 - uMix * 1.08;
        float k = smoothstep(edge - 0.004, edge + 0.004, vUv.y);
        // The outgoing screen drifts up and dims; the incoming one settles into place
        vec4 a = texture2D(uA, vUv + vec2(0.0, -uMix * 0.025));
        vec4 b = texture2D(uB, vUv + vec2(0.0, (1.0 - uMix) * 0.035));
        vec3 col = mix(a.rgb * (1.0 - 0.18 * uMix), b.rgb, k);
        float dist = vUv.y - edge;
        float line = exp(-pow(dist * 160.0, 2.0));
        float trail = smoothstep(0.0, 0.08, dist) * (1.0 - smoothstep(0.08, 0.22, dist));
        vec3 teal = vec3(0.08, 0.72, 0.65);
        col = mix(col, teal, scanning * (line * 0.9 + trail * 0.08));
        // Glass: a soft diagonal reflection that follows the phone's turn, and a faint edge vignette
        float d = vUv.x * 0.8 + vUv.y * 0.6 - uSheen;
        col += vec3(1.0) * 0.06 * exp(-d * d * 14.0);
        vec2 q = vUv * 2.0 - 1.0;
        col *= 1.0 - 0.06 * pow(max(abs(q.x), abs(q.y)), 6.0);
        gl_FragColor = vec4(col * uDim, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = DEPTH / 2 + BEVEL + 0.002;
  phone.add(screen);

  // Light the screen throws around the phone — faint by day, a soft teal spill at night
  const spillTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(94,234,212,0.55)');
    grd.addColorStop(0.45, 'rgba(20,184,166,0.18)');
    grd.addColorStop(1, 'rgba(20,184,166,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const spill = new THREE.Sprite(new THREE.SpriteMaterial({ map: spillTex, transparent: true, depthWrite: false, opacity: 0.2 }));
  spill.scale.set(5.4, 7.2, 1);
  spill.position.z = -0.6;

  const rig = new THREE.Group();
  rig.add(spill, phone);
  scene.add(rig);

  /* ───── 24-hour pulse ring ───── */
  const R = 2.45;
  class Circle extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) {
      const a = t * Math.PI * 2;
      return target.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    }
  }
  const FRONT = 0.75 + 0.035; // ring position (in turns) that faces the viewer, slightly right
  const ringMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uHead: { value: FRONT },
      uAmp: { value: 0.42 },
      uDraw: { value: 0 },
      uNight: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uHead;
      uniform float uAmp;
      varying float vD;
      varying float vU;
      float g(float x, float c, float w) { return exp(-pow((x - c) / w, 2.0)); }
      float ecg(float x) {
        return 0.12 * g(x, -0.06, 0.013) - 0.14 * g(x, -0.012, 0.004) + 1.0 * g(x, 0.0, 0.0048)
             - 0.28 * g(x, 0.011, 0.005) + 0.22 * g(x, 0.055, 0.017);
      }
      void main() {
        float d = fract(uv.x - uHead + 0.5) - 0.5;
        vD = d;
        vU = uv.x;
        vec3 p = position;
        p.z += ecg(d) * uAmp;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uDraw;
      uniform float uNight;
      varying float vD;
      varying float vU;
      void main() {
        float drawn = step(fract(vU - 0.85 + 1.0), uDraw);
        vec3 dayCol = vec3(0.05, 0.45, 0.42);
        vec3 nightCol = vec3(0.37, 0.92, 0.83);
        vec3 base = mix(dayCol, nightCol, uNight);
        vec3 pulse = vec3(0.96, 0.25, 0.37);
        float head = exp(-abs(vD) * 26.0);
        float trail = vD < 0.0 ? exp(vD * 5.0) : exp(-vD * 40.0);
        vec3 col = mix(base, pulse, head * 0.9);
        float alpha = (0.22 + 0.78 * trail) * drawn;
        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }`,
  });
  const ring = new THREE.Mesh(new THREE.TubeGeometry(new Circle(), 900, coarse ? 0.016 : 0.013, 8, true), ringMat);

  // Hour ticks: 24 small, the six moments longer
  const tickMat = new THREE.MeshBasicMaterial({ color: 0x0b2b2e, transparent: true, opacity: 0.35, depthWrite: false });
  const momentTickMat = new THREE.MeshBasicMaterial({ color: 0x0d9488, transparent: true, opacity: 0.9, depthWrite: false });
  const ticks = new THREE.Group();
  const small = new THREE.BoxGeometry(0.012, 0.09, 0.012);
  const long = new THREE.BoxGeometry(0.02, 0.2, 0.02);
  const momentHours = S.hours.map((h) => Math.round(h * 4) / 4);
  for (let h = 0; h < 24; h++) {
    const m = new THREE.Mesh(small, tickMat);
    placeTick(m, h, 0.16);
    ticks.add(m);
  }
  momentHours.forEach((h) => {
    const m = new THREE.Mesh(long, momentTickMat);
    placeTick(m, h, 0.22);
    ticks.add(m);
  });
  function placeTick(m, hour, out) {
    const a = (hour / 24) * Math.PI * 2;
    m.position.set(Math.cos(a) * (R + out), Math.sin(a) * (R + out), 0);
    m.rotation.z = a - Math.PI / 2;
  }

  // The "now" bead with a soft halo
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(244,63,94,0.9)');
    grd.addColorStop(0.25, 'rgba(244,63,94,0.35)');
    grd.addColorStop(1, 'rgba(244,63,94,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const bead = new THREE.Group();
  bead.add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf43f5e })));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
  halo.scale.setScalar(0.7);
  bead.add(halo);
  const fa = FRONT * Math.PI * 2;
  bead.position.set(Math.cos(fa) * R, Math.sin(fa) * R, 0.42);

  const dial = new THREE.Group(); // spins so the current hour sits at FRONT
  dial.add(ticks);
  const ringGroup = new THREE.Group();
  ringGroup.add(ring, dial, bead);
  ringGroup.rotation.set(-1.28, 0, 0.12);
  ringGroup.position.y = -0.85;
  rig.add(ringGroup);

  /* ───── Particles: dust by day, stars by night ───── */
  const COUNT = coarse ? 260 : 620;
  const pts = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const r = 3.2 + Math.random() * 6;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pts[i * 3] = r * Math.sin(ph) * Math.cos(th) * 1.6;
    pts[i * 3 + 1] = r * Math.cos(ph);
    pts[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 2;
    seeds[i] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uPx;
      varying float vSeed;
      void main() {
        vSeed = aSeed;
        vec3 p = position;
        p.y += sin(uTime * 0.2 + aSeed * 40.0) * 0.15;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.4 + aSeed * 2.2) * uPx * (9.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uNight;
      varying float vSeed;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        float tw = 0.55 + 0.45 * sin(uTime * (0.8 + vSeed * 2.0) + vSeed * 20.0);
        vec3 dayCol = vec3(0.05, 0.36, 0.34);
        vec3 nightCol = vec3(0.92, 0.97, 1.0);
        vec3 col = mix(dayCol, nightCol, uNight);
        float alpha = a * mix(0.22, 0.85 * tw, uNight);
        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }`,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  /* ───── Poses for each moment ───── */
  const POSE = [
    { ry: -0.46, rx: 0.1, rz: 0.06 },
    { ry: 0.36, rx: -0.04, rz: -0.05 },
    { ry: -0.32, rx: 0.07, rz: 0.04 },
    { ry: 0.4, rx: -0.03, rz: -0.06 },
    { ry: -0.28, rx: 0.06, rz: 0.03 },
    { ry: 0.24, rx: 0.0, rz: -0.02 },
  ];
  const smooth = (k) => k * k * (3 - 2 * k);
  const lerp = (a, b, k) => a + (b - a) * k;

  let layout = { x: 0, y: 0, s: 1 };
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    renderer.setSize(w, h, false);
    dustMat.uniforms.uPx.value = renderer.getPixelRatio();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const viewH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const viewW = viewH * camera.aspect;
    if (window.innerWidth <= 860) {
      // Phone screens: the phone sits left of the dial in the top part of the section
      const s = Math.min(1, (viewH * 0.6) / BH);
      layout = { x: -viewW * 0.2, y: viewH * 0.03, s };
    } else {
      // Desktop: between the headline (left) and the dial (right)
      const s = Math.min(1.05, (viewH * 0.6) / BH);
      layout = { x: viewW * 0.075, y: 0, s };
    }
    // Keep the ring clear of the dial text on wide layouts
    ringGroup.scale.setScalar(window.innerWidth <= 860 ? 0.9 : 0.8);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  /* ───── Loop ───── */
  const clock = new THREE.Clock();
  const t0 = performance.now();
  // Critically damped springs: scroll and pointer settle without lag or wobble
  const scroll = { x: S.t, v: 0 };
  const ptrX = { x: 0, v: 0 };
  const ptrY = { x: 0, v: 0 };
  function spring(s, target, dt, w) {
    const a = -2 * w * s.v - w * w * (s.x - target);
    s.v += a * dt;
    s.x += s.v * dt;
  }
  const easeOut = (k) => 1 - Math.pow(1 - k, 4);
  let shown = false;

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    if (!S.visible || document.hidden) return;
    const time = clock.elapsedTime;
    const intro = reduced ? 1 : easeOut(Math.min(1, (performance.now() - t0) / 2200));

    if (reduced) scroll.x = S.t;
    else spring(scroll, S.t, dt, 7.5);
    spring(ptrX, reduced ? 0 : S.pointer.x, dt, 3.2);
    spring(ptrY, reduced ? 0 : S.pointer.y, dt, 3.2);
    const t = Math.max(0, Math.min(POSE.length - 1, scroll.x));
    const i0 = Math.min(Math.floor(t), POSE.length - 1);
    const i1 = Math.min(i0 + 1, POSE.length - 1);
    const f = t - i0;
    const k = smooth(f);
    const arc = Math.sin(f * Math.PI); // 0 at a moment, 1 halfway to the next
    const idle = reduced ? 0 : 1;

    const p0 = POSE[i0], p1 = POSE[i1];
    const dir = Math.sign(p1.ry - p0.ry) || 1;
    // Between moments the phone turns a little past its next pose, drifts back and lifts, then settles
    phone.rotation.y = lerp(p0.ry, p1.ry, k) + dir * arc * 0.22 + Math.sin(time * 0.45) * 0.035 * idle + ptrX.x * 0.18 + (1 - intro) * -1.3;
    phone.rotation.x = lerp(p0.rx, p1.rx, k) - arc * 0.05 + ptrY.x * 0.08 + (1 - intro) * 0.35;
    phone.rotation.z = lerp(p0.rz, p1.rz, k) - dir * arc * 0.03;
    phone.position.y = Math.sin(time * 0.7) * 0.045 * idle + arc * 0.1 - (1 - intro) * 1.6;
    phone.position.z = -arc * 0.7 - (1 - intro) * 1.5;

    rig.position.set(layout.x, layout.y, 0);
    rig.scale.setScalar(layout.s);

    // A slow push-in over the day, with a hint of parallax from the pointer
    camera.position.set(ptrX.x * 0.25, -ptrY.x * 0.15, 13.4 - t * 0.1);
    camera.lookAt(layout.x * 0.15, 0, 0);

    spill.material.opacity = lerp(0.14, 0.6, S.night) * intro;

    // Screen: scan to the next moment's screen during the middle of the transition
    const m = smooth(Math.min(1, Math.max(0, (f - 0.3) / 0.4)));
    screenMat.uniforms.uA.value = textures[i0];
    screenMat.uniforms.uB.value = textures[i1];
    screenMat.uniforms.uMix.value = i0 === i1 ? 0 : m;
    screenMat.uniforms.uSheen.value = 0.7 + phone.rotation.y * 1.4;
    screenMat.uniforms.uDim.value = lerp(1, 0.9, S.night);

    // Ring: dial turns so the current hour meets the heartbeat
    const hour = lerp(S.hours[i0], S.hours[i1], k);
    dial.rotation.z = (FRONT - hour / 24) * Math.PI * 2;
    const beatPhase = (time * 1.2) % 1;
    const beat = reduced ? 1 : 0.55 + 0.45 * Math.exp(-beatPhase * 6);
    ringMat.uniforms.uAmp.value = 0.42 * beat;
    ringMat.uniforms.uDraw.value = reduced ? 1 : smooth(Math.min(1, (performance.now() - t0 - 300) / 1900));
    ringMat.uniforms.uNight.value = S.night;
    halo.scale.setScalar(0.55 + 0.35 * beat);
    bead.visible = ringMat.uniforms.uDraw.value > 0.98;
    ringGroup.rotation.y = ptrX.x * 0.06;
    tickMat.color.set(S.night > 0.5 ? 0xd1d5db : 0x0b2b2e);
    tickMat.opacity = lerp(0.35, 0.45, S.night);
    momentTickMat.color.set(S.night > 0.5 ? 0x5eead4 : 0x0d9488);

    dustMat.uniforms.uTime.value = time;
    dustMat.uniforms.uNight.value = S.night;
    dust.rotation.y = time * 0.01 * idle + ptrX.x * 0.05;

    titanium.envMapIntensity = lerp(1.2, 0.7, S.night);
    renderer.toneMappingExposure = lerp(1.05, 0.95, S.night);

    renderer.render(scene, camera);
    if (!shown) {
      shown = true;
      day.classList.add('is-3d');
    }
  }
  requestAnimationFrame(frame);
}
