/**
 * iPhone cable: a flat USB-C ribbon (6.5 × 0.8 mm, handover dimensions) with a low-profile
 * flat cap in the phone's port and a proper USB-C plug (metal shell, molded boot, strain relief)
 * at the Limpet end. Inside the Limpet the ribbon lies flat in the tray and leaves it over the
 * tray's open rim; only from the rim on does it curve freely to the phone's port.
 * Rendered inside the iPhone group (rig space).
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PHONE_PORT } from './choreography';

const CURVE_SEGS = 44;
const STRAIGHT_SEGS = 10;
const SEGMENTS = CURVE_SEGS + STRAIGHT_SEGS;
const WIDTH = 0.0065;
const THICK = 0.0008;
/** distance from the seated connector origin to the tray's open rim (Limpet local +Z) */
const RIM = 0.0255;
/** the ribbon drops from the connector level (3.2 mm above the underside) to the leather face and slips out under the aluminium rim */
const EXIT_DROP = 0.0037;
/** distance from the seated connector origin to the end of the strain relief, where the ribbon starts */
const PLUG_LEN = 0.0145;

export type CableHandle = { update: (connectorPos: THREE.Vector3, connectorDir: THREE.Vector3, connectorUp: THREE.Vector3, opacity: number) => void };

const p0 = new THREE.Vector3();
const p1 = new THREE.Vector3();
const t0 = new THREE.Vector3();
const t1 = new THREE.Vector3();
const pt = new THREE.Vector3();
const tan = new THREE.Vector3();
const nrm = new THREE.Vector3();
const bin = new THREE.Vector3(1, 0, 0);
const prev = new THREE.Vector3();
const dirTmp = new THREE.Vector3();
const rim = new THREE.Vector3();
const plugEnd = new THREE.Vector3();
const lookM = new THREE.Matrix4();
const origin = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const Zax = new THREE.Vector3(0, 0, 1);

/** Where the ribbon leaves the port cap (just outside the phone's bottom edge). */
const CAP_EXIT = new THREE.Vector3(PHONE_PORT.x, PHONE_PORT.y + 0.0017, PHONE_PORT.z + 0.0019);

function hermite(s: number, out: THREE.Vector3) {
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  out.set(
    h00 * p0.x + h10 * t0.x + h01 * p1.x + h11 * t1.x,
    h00 * p0.y + h10 * t0.y + h01 * p1.y + h11 * t1.y,
    h00 * p0.z + h10 * t0.z + h01 * p1.z + h11 * t1.z,
  );
}

/** Position along the whole path: s ∈ [0,1] → curve (port → rim) then straight (rim → plug). */
function pathAt(s: number, out: THREE.Vector3) {
  const split = CURVE_SEGS / SEGMENTS;
  if (s <= split) return hermite(s / split, out);
  const k = (s - split) / (1 - split);
  return out.lerpVectors(rim, plugEnd, k);
}

export function Cable({ handleRef }: { handleRef: React.MutableRefObject<CableHandle | null> }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const connRef = useRef<THREE.Group>(null);
  const rootRef = useRef<THREE.Group>(null);
  const mats = useRef<THREE.Material[]>([]);

  const geometry = useMemo(() => {
    const sections = SEGMENTS + 1;
    const positions = new Float32Array(sections * 4 * 3);
    const indices: number[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const a = i * 4, b = (i + 1) * 4;
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        indices.push(a + k, b + k, b + k2, a + k, b + k2, a + k2);
      }
    }
    indices.push(0, 2, 1, 0, 3, 2);
    const l = SEGMENTS * 4;
    indices.push(l, l + 1, l + 2, l, l + 2, l + 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setIndex(indices);
    return g;
  }, []);

  const plugGeo = useMemo(() => ({
    shell: new RoundedBoxGeometry(0.0084, 0.0026, 0.0075, 3, 0.0011),
    slot: new THREE.BoxGeometry(0.0066, 0.0013, 0.0006),
    boot: new RoundedBoxGeometry(0.0106, 0.0048, 0.0092, 3, 0.0019),
    relief: new RoundedBoxGeometry(0.0078, 0.0032, 0.006, 3, 0.0014),
    cap: new RoundedBoxGeometry(0.0096, 0.0034, 0.0014, 2, 0.0005),
    capBoot: new RoundedBoxGeometry(0.0068, 0.0022, 0.0014, 2, 0.0005),
  }), []);

  handleRef.current = useMemo<CableHandle>(() => ({
    update(connectorPos, connectorDir, connectorUp, opacity) {
      const pos = geometry.attributes.position as THREE.BufferAttribute;
      rim.copy(connectorPos).addScaledVector(connectorDir, RIM).addScaledVector(connectorUp, -EXIT_DROP);
      plugEnd.copy(connectorPos).addScaledVector(connectorDir, PLUG_LEN);
      // curve: port cap → tray rim
      p0.copy(CAP_EXIT);
      p1.copy(rim);
      const dist = p0.distanceTo(p1);
      // start tangent: along +Z when the connector faces the phone (resting), up (+Y) when it faces away (docked: loop over the edge)
      const k = THREE.MathUtils.clamp((connectorDir.dot(Zax) + 1) / 2, 0, 1);
      dirTmp.set(0, k, 1 - k).normalize();
      // short gaps (docked: rim flush with the phone edge) get a tight bend that hugs the edge
      const m0 = THREE.MathUtils.clamp(dist * 0.5, 0.009, 0.045);
      const m1 = THREE.MathUtils.clamp(dist * 0.65, 0.008, 0.055);
      t0.copy(dirTmp).multiplyScalar(m0);
      t1.copy(connectorDir).multiplyScalar(-m1); // arrives at the rim travelling into the tray
      for (let i = 0; i <= SEGMENTS; i++) {
        const s = i / SEGMENTS;
        pathAt(s, pt);
        pathAt(Math.min(1, s + 0.002), tan);
        pathAt(Math.max(0, s - 0.002), prev);
        tan.sub(prev).normalize();
        if (tan.lengthSq() < 1e-9) tan.set(0, 0, 1);
        nrm.crossVectors(tan, bin).normalize();
        const hw = WIDTH / 2, ht = THICK / 2;
        const base = i * 4;
        pos.setXYZ(base + 0, pt.x + bin.x * hw + nrm.x * ht, pt.y + bin.y * hw + nrm.y * ht, pt.z + bin.z * hw + nrm.z * ht);
        pos.setXYZ(base + 1, pt.x - bin.x * hw + nrm.x * ht, pt.y - bin.y * hw + nrm.y * ht, pt.z - bin.z * hw + nrm.z * ht);
        pos.setXYZ(base + 2, pt.x - bin.x * hw - nrm.x * ht, pt.y - bin.y * hw - nrm.y * ht, pt.z - bin.z * hw - nrm.z * ht);
        pos.setXYZ(base + 3, pt.x + bin.x * hw - nrm.x * ht, pt.y + bin.y * hw - nrm.y * ht, pt.z + bin.z * hw - nrm.z * ht);
      }
      pos.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const c = connRef.current;
      if (c) {
        c.position.copy(connectorPos);
        lookM.lookAt(connectorDir, origin, up);
        c.quaternion.setFromRotationMatrix(lookM);
      }
      if (rootRef.current) rootRef.current.visible = opacity > 0.01;
      for (const m of [matRef.current, ...mats.current]) {
        if (!m) continue;
        if (Math.abs(m.opacity - opacity) > 0.001) { m.opacity = opacity; m.transparent = opacity < 1; m.needsUpdate = true; }
      }
    },
  }), [geometry]);

  const reg = (m: THREE.Material | null) => { if (m && !mats.current.includes(m)) mats.current.push(m); };

  return (
    <group ref={rootRef}>
      <mesh geometry={geometry} frustumCulled={false}>
        <meshStandardMaterial ref={matRef} color="#111214" roughness={0.78} metalness={0} />
      </mesh>
      {/* flat low-profile cap seated in the phone's port: silver plate + black strain relief */}
      <group position={[PHONE_PORT.x, PHONE_PORT.y, PHONE_PORT.z]}>
        <mesh position={[0, 0, -0.003]}>
          <boxGeometry args={[0.0084, 0.0024, 0.0068]} />
          <meshStandardMaterial ref={reg} color="#b9babd" metalness={0.9} roughness={0.35} />
        </mesh>
        <mesh geometry={plugGeo.cap} position={[0, 0, 0.0007]}>
          <meshStandardMaterial ref={reg} color="#cfd0d3" metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh geometry={plugGeo.capBoot} position={[0, 0.0011, 0.0019]}>
          <meshStandardMaterial ref={reg} color="#111214" metalness={0} roughness={0.7} />
        </mesh>
      </group>
      {/* USB-C plug at the Limpet end (group +Z points into the tray's open end; the shell goes into the port) */}
      <group ref={connRef}>
        <mesh geometry={plugGeo.shell} position={[0, 0, -0.0036]}>
          <meshStandardMaterial ref={reg} color="#a9abae" metalness={0.95} roughness={0.28} />
        </mesh>
        <mesh geometry={plugGeo.slot} position={[0, 0, -0.0073]}>
          <meshStandardMaterial ref={reg} color="#0a0a0b" metalness={0.2} roughness={0.6} />
        </mesh>
        <mesh geometry={plugGeo.boot} position={[0, 0, 0.0046]}>
          <meshStandardMaterial ref={reg} color="#131416" metalness={0} roughness={0.62} />
        </mesh>
        <mesh geometry={plugGeo.relief} position={[0, 0, 0.0118]}>
          <meshStandardMaterial ref={reg} color="#131416" metalness={0} roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}
