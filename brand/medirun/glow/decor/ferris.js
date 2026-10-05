// MEDIRUN Glow — the Mtatsminda Ferris wheel (lab, 2026-10-05). Built as exact geometry, not a generated model:
// a wheel is thin tubes and spokes, which an image-to-3D model melts into a blob. Steel: twin rims tied by a zigzag
// truss, tangential spokes to a hub on an axle, two A-frame legs, a lit station. Glass cabins hang from the rim
// and stay upright as it turns. Thousands of LEDs on rims, truss and spokes run a light show that changes every
// few seconds (rainbow sweep, pulses from the hub, starlight, red-and-white chase, spiral).
// Local frame of the wheel: x = across the face, y = the axle (it points at `face`), z = up; metres.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LED_FOG = 'uniform float uRefW; uniform vec3 uFog; vec3 fogged(vec3 c, float w){ return mix(c, uFog, smoothstep(2.5, 8.0, w / uRefW) * 0.5); }';

/** A cylinder from a to b (Vector3), radius r. */
function strut(a, b, r, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  g.deleteAttribute('uv');
  return g;
}

export function createFerrisWheel({ U, diameter = 62, hub = 37, cabins = 36, spokes = 32 } = {}) {
  const R = diameter / 2, Ri = R * 0.86, W = 2.3, HUBW = 3.6;
  const root = new THREE.Group(), wheel = new THREE.Group();
  wheel.position.z = hub; root.add(wheel);
  const P = (a, r, y) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);   // a point of the wheel (x–z plane)

  // ---------- steel ----------
  const steel = new THREE.MeshStandardMaterial({ color: 0x5d6675, metalness: 0.6, roughness: 0.4, emissive: 0x05080f });
  const parts = [];
  for (const y of [-W, W]) {
    parts.push(new THREE.TorusGeometry(R, 0.42, 8, 220).rotateX(Math.PI / 2).translate(0, y, 0));
    parts.push(new THREE.TorusGeometry(Ri, 0.3, 6, 200).rotateX(Math.PI / 2).translate(0, y, 0));
    for (let k = 0; k < 72; k++) {                                        // zigzag truss between the two rims
      const a0 = (k / 72) * Math.PI * 2, a1 = ((k + 0.5) / 72) * Math.PI * 2, a2 = ((k + 1) / 72) * Math.PI * 2;
      parts.push(strut(P(a0, R, y), P(a1, Ri, y), 0.12), strut(P(a1, Ri, y), P(a2, R, y), 0.12));
    }
    for (let k = 0; k < spokes; k++) {                                    // tangential spokes, crossing like a bicycle wheel
      const a = (k / spokes) * Math.PI * 2, off = (k % 2 ? 1 : -1) * 0.35;
      parts.push(strut(P(a + off, 2.3, y * 1.55), P(a, Ri, y), 0.09, 4));
    }
  }
  for (let k = 0; k < 36; k++) { const a = (k / 36) * Math.PI * 2; parts.push(strut(P(a, R, -W), P(a, R, W), 0.16)); }   // ties across
  parts.push(new THREE.CylinderGeometry(2.3, 2.3, HUBW * 2, 24).translate(0, 0, 0));      // hub (axis y already)
  const wheelSteel = new THREE.Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => { g.deleteAttribute('uv'); return g; })), steel);
  wheel.add(wheelSteel);

  // A-frame legs from the ground to both ends of the axle, braced, and the boarding station under the wheel
  const legs = [], foot = R * 0.62, out = 9;
  for (const s of [-1, 1]) {
    const top = new THREE.Vector3(0, s * (HUBW + 0.6), hub);
    for (const x of [-foot, foot]) legs.push(strut(new THREE.Vector3(x, s * out, 0), top, 0.75, 10));
    legs.push(strut(new THREE.Vector3(-foot * 0.55, s * out * 0.55, hub * 0.45), new THREE.Vector3(foot * 0.55, s * out * 0.55, hub * 0.45), 0.4, 8));
  }
  legs.push(strut(new THREE.Vector3(0, -(HUBW + 0.6), hub), new THREE.Vector3(0, HUBW + 0.6, hub), 0.9, 12));   // axle
  root.add(new THREE.Mesh(mergeGeometries(legs.map((g) => g.toNonIndexed())), steel));
  const station = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 4.5).translate(0, 0, 2.25),
    new THREE.MeshStandardMaterial({ color: 0x2a3140, emissive: 0x6b4a22, emissiveIntensity: 0.9, roughness: 0.6 }));
  root.add(station);

  // ---------- cabins: lit glass capsules hanging from the outer rim, always upright ----------
  const cabinGeo = new THREE.CapsuleGeometry(1.15, 1.5, 6, 14).rotateX(Math.PI / 2);
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0xdfe8f2, metalness: 0.1, roughness: 0.15, emissive: 0xffb36b, emissiveIntensity: 0.85 });
  const cabinMesh = new THREE.InstancedMesh(cabinGeo, cabinMat, cabins);
  const tint = new THREE.Color();
  for (let i = 0; i < cabins; i++) cabinMesh.setColorAt(i, tint.setHSL((i / cabins + 0.05) % 1, 0.35, 0.82));
  cabinMesh.frustumCulled = false;
  root.add(cabinMesh);

  // ---------- LEDs ----------
  const pos = [], polar = [], size = [];
  const led = (p, a, rn, kind, s) => { pos.push(p.x, p.y, p.z); polar.push(a, rn, kind, Math.random()); size.push(s); };
  for (const y of [-W, W]) {
    for (let k = 0; k < 420; k++) { const a = (k / 420) * Math.PI * 2; led(P(a, R + 0.45, y), a, 1, 0, 3.0); }
    for (let k = 0; k < 340; k++) { const a = (k / 340) * Math.PI * 2; led(P(a, Ri - 0.3, y), a, 0.86, 0, 2.4); }
    for (let k = 0; k < spokes; k++) {
      const a = (k / spokes) * Math.PI * 2, off = (k % 2 ? 1 : -1) * 0.35, A = P(a + off, 2.3, y * 1.55), B = P(a, Ri, y);
      for (let j = 1; j <= 34; j++) { const t = j / 35, p = A.clone().lerp(B, t); led(p, Math.atan2(p.z, p.x), Math.hypot(p.x, p.z) / R, 1, 2.0); }
    }
  }
  const ledGeo = new THREE.BufferGeometry();
  ledGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  ledGeo.setAttribute('aPolar', new THREE.Float32BufferAttribute(polar, 4));
  ledGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  const show = { mode: 0, next: 1, mix: 0, at: 0 };
  const ledMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uRefW: U.uRefW, uFog: U.uFog, uPxM: U.uPxM, uPR: U.uPR, uRot: { value: 0 }, uMode: { value: 0 }, uNext: { value: 1 }, uMix: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec4 aPolar; attribute float aSize;
      uniform float uTime, uRefW, uPxM, uPR, uRot, uMode, uNext, uMix;
      varying vec3 vC; varying float vW;
      vec3 hsv(float h, float s, float v){ vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1.0), k, s); }
      vec3 show(float m, float a, float rn, float kind, float rnd){
        float A = a + uRot;
        if (m < 0.5) return hsv(fract(A / 6.2832 + uTime * 0.04), 0.85, 1.25);                              // rainbow sweep
        if (m < 1.5) { float p = fract(rn * 1.6 - uTime * 0.45); float b = smoothstep(0.0, 0.08, p) * (1.0 - smoothstep(0.08, 0.4, p));
                       return mix(vec3(0.08, 0.95, 0.85), vec3(1.0, 0.72, 0.18), rn) * (0.45 + 1.6 * b); }  // pulses from the hub
        if (m < 2.5) return vec3(1.0, 0.95, 0.86) * (0.5 + 1.5 * pow(0.5 + 0.5 * sin(uTime * 5.0 + rnd * 60.0), 10.0));   // starlight
        if (m < 3.5) { float s = step(0.5, fract(A / 6.2832 * 18.0 - uTime * 0.7)); return mix(vec3(1.0, 0.1, 0.12), vec3(1.0, 0.93, 0.85), s) * 1.15; }  // red & white chase
        return hsv(fract(rn * 0.9 + A / 6.2832 - uTime * 0.12), 0.9, 1.2);                                 // spiral
      }
      void main(){
        vC = mix(show(uMode, aPolar.x, aPolar.y, aPolar.z, aPolar.w), show(uNext, aPolar.x, aPolar.y, aPolar.z, aPolar.w), uMix);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vW = gl_Position.w;
        gl_PointSize = clamp(aSize * uPxM * uPR * uRefW / gl_Position.w, 2.5, 44.0);
      }`,
    fragmentShader: `
      ${LED_FOG}
      varying vec3 vC; varying float vW;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
        vec3 c = vC * exp(-d * d * 3.0) * 1.3 + mix(vC, vec3(1.0), 0.45) * smoothstep(0.5, 0.05, d) * 2.0;
        gl_FragColor = vec4(fogged(c, vW) * (1.0 - smoothstep(0.7, 1.0, d)), 1.0);
      }`,
  });
  const leds = new THREE.Points(ledGeo, ledMat); leds.frustumCulled = false; leds.renderOrder = 6; wheel.add(leds);

  // a warm haze round the hub and a pool of light on the ground
  const glow = new THREE.Mesh(new THREE.CircleGeometry(R * 1.25, 64).rotateX(Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vP; void main(){ float d = length(vP) / ${(R * 1.25).toFixed(1)};
      float a = pow(max(0.0, 1.0 - d), 2.5) * 0.10 * (0.85 + 0.15 * sin(uTime * 0.8)); gl_FragColor = vec4(vec3(0.55, 0.45, 1.0) * a, 1.0); }`,
  }));
  glow.renderOrder = 5; wheel.add(glow);

  const tmp = new THREE.Object3D();
  let rot = 0;
  return {
    group: root,
    update(dt, t) {
      rot += dt * ((Math.PI * 2) / 300);                // one turn in five minutes
      wheel.rotation.y = -rot;
      ledMat.uniforms.uRot.value = rot;
      for (let i = 0; i < cabins; i++) {                 // cabins swing level, hanging 1.6 m under the rim
        const a = (i / cabins) * Math.PI * 2 + rot;
        tmp.position.set(Math.cos(a) * (R + 0.4), 0, hub + Math.sin(a) * (R + 0.4) - 2.4);
        tmp.rotation.set(0, Math.sin(t * 0.7 + i) * 0.03, 0); tmp.updateMatrix();
        cabinMesh.setMatrixAt(i, tmp.matrix);
      }
      cabinMesh.instanceMatrix.needsUpdate = true;
      if (t - show.at > 11) { show.at = t; show.mode = show.next; show.next = (show.next + 1) % 5; }
      const k = Math.min(1, Math.max(0, (t - show.at - 9) / 2));        // the last two seconds blend into the next show
      ledMat.uniforms.uMode.value = show.mode; ledMat.uniforms.uNext.value = show.next; ledMat.uniforms.uMix.value = k;
    },
  };
}
