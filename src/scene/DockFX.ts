/**
 * Experimental contact effects on the dock surface (MacBook lid, iPhone back), drawn on a plane just under the
 * Limpet's docked footprint:
 *  - a contact shadow that grows darker and tighter as the Limpet closes in (reads as proximity, purely physical),
 *  - a thin ring of light that runs outwards from the footprint at the moment of contact and fades.
 */
import * as THREE from 'three';

/** ring of light after contact (ms) */
export const RING_MS = 700;

export type Footprint = { cx: number; cz: number; hx: number; hz: number; y: number };

/** the Limpet's footprint in its own frame: centre and half size in X / Z, and the contact face's height */
export function footprintOf(corners: THREE.Vector3[], side: 'bottom' | 'top'): Footprint {
  const box = new THREE.Box3().setFromPoints(corners);
  return {
    cx: (box.min.x + box.max.x) / 2, cz: (box.min.z + box.max.z) / 2,
    hx: (box.max.x - box.min.x) / 2, hz: (box.max.z - box.min.z) / 2,
    y: side === 'bottom' ? box.min.y : box.max.y,
  };
}

const VERT = /* glsl */ `
  varying vec2 vP;
  void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SDF = /* glsl */ `
  uniform vec2 uHalf; uniform float uR;
  // the tray end (Limpet +Z = plane -y) sits at the very edge of the lid / the phone: nothing is drawn past it
  float trayMask(vec2 p) { return smoothstep(-uHalf.y - 0.001, -uHalf.y + 0.008, p.y); }
  float sdRR(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
`;
const SHADOW_FRAG = /* glsl */ `
  varying vec2 vP; uniform float uProx; uniform float uOpacity;
  ${SDF}
  void main() {
    float d = sdRR(vP, uHalf, uR);
    float spread = mix(0.02, 0.0035, uProx);
    float a = uProx * uProx * (1.0 - smoothstep(-0.002, spread, d)) * 0.42 * uOpacity * trayMask(vP);
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  }
`;
const RING_FRAG = /* glsl */ `
  varying vec2 vP; uniform float uT; uniform float uAlpha; uniform vec3 uColor; uniform float uOpacity; uniform float uSpread; uniform float uMaxX;
  ${SDF}
  void main() {
    if (uT < 0.0) discard;
    float d = sdRR(vP, uHalf, uR);
    float ro = uT * uSpread;
    float w = 0.0012 + uT * uSpread * 0.15;
    float x = (d - ro) / w;
    float a = exp(-x * x) * pow(1.0 - uT, 1.6) * uAlpha * uOpacity * smoothstep(-0.001, 0.001, d) * trayMask(vP) * (1.0 - smoothstep(uMaxX - 0.003, uMaxX, abs(vP.x)));
    gl_FragColor = vec4(uColor, a);
  }
`;

export class DockSurface {
  readonly group = new THREE.Group();
  private shadow: THREE.ShaderMaterial;
  private ring: THREE.ShaderMaterial;

  /**
   * spread: how far the ring travels out from the footprint (m); maxX: half width of the surface around the
   * Limpet (m from its centre line) — the ring fades out before it would run past the surface's side edges
   */
  constructor(fp: Footprint, pos: THREE.Vector3, quat: THREE.Quaternion, color: string, ringAlpha: number, spread: number, maxX = Infinity) {
    this.group.position.copy(pos);
    this.group.quaternion.copy(quat);
    const margin = 0.05;
    const geo = new THREE.PlaneGeometry(2 * (fp.hx + margin), 2 * (fp.hz + margin));
    const shared = { uHalf: { value: new THREE.Vector2(fp.hx, fp.hz) }, uR: { value: Math.min(fp.hx, fp.hz) * 0.3 }, uOpacity: { value: 1 } };
    const base = { vertexShader: VERT, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
    this.shadow = new THREE.ShaderMaterial({ ...base, fragmentShader: SHADOW_FRAG, uniforms: { ...shared, uProx: { value: 0 } } });
    this.ring = new THREE.ShaderMaterial({ ...base, fragmentShader: RING_FRAG, uniforms: { ...shared, uT: { value: -1 }, uAlpha: { value: ringAlpha }, uSpread: { value: spread }, uMaxX: { value: Math.min(maxX, 10) }, uColor: { value: new THREE.Color(color) } } });
    for (const [mat, order] of [[this.shadow, 1], [this.ring, 2]] as const) {
      const m = new THREE.Mesh(geo, mat);
      // the plane lies in the Limpet's X/Z, a hair outside its contact face
      m.rotation.x = -Math.PI / 2;
      m.position.set(fp.cx, fp.y - 0.0004, fp.cz);
      m.renderOrder = order;
      this.group.add(m);
    }
    this.group.visible = false;
  }

  /** prox: 0 away … 1 seated; ringT: 0 … 1 after contact, < 0 none; opacity: fades with the device */
  update(prox: number, ringT: number, opacity: number) {
    this.shadow.uniforms.uProx.value = prox;
    this.ring.uniforms.uT.value = ringT;
    this.shadow.uniforms.uOpacity.value = this.ring.uniforms.uOpacity.value = opacity;
    this.group.visible = opacity > 0.01 && (prox > 0.01 || ringT >= 0);
  }
}
