/**
 * `?render=dock` (dev only): renders the laptop dock plate with its flat cable from the page's own 3D scene (same
 * model, materials and studio light as the product sequence), square with a transparent background, and saves it to
 * public/images through the dev server (render-sink plugin in vite.config.ts). The pricing section shows the saved
 * image next to the Limpet on the Pro card.
 *
 * The plate is part of the MacBook model (it sits on the lid); the laptop itself is hidden. The lid is laid flat
 * (180°) so the cable, modelled for the open lid, lies straight instead of bending round a hinge that is not there.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Studio, tuneMaterial, type Tex } from './StageCanvas';
import { stageConfig, macStageMatrix, phoneStageMatrix, dockedPose, hingeQuaternion } from './choreography';
import { CableBend } from './LidBend';
import { leatherTextures, leatherFromImage, grainTexture, fabricTexture } from './textures';

export type CardMotif = 'dock';
const DRACO = '/draco/';
/** output size (px, square) */
const SIZE = 1024;
/** meshes of the MacBook model that make up the dock plate and its cable; everything else is hidden */
const SHOWN = new Set([
  'SSD_Laptop_plate_001', 'SSD_Cable_Plate_001', 'SSD_Sticker_Adhesive_To_Laptop_001', 'SSD_USB_Port', 'Cable_Internal_Fabric',
  'Cable_Flexible_Fabric', 'Cable_Prototype_connector_solder_pad', 'Connector_Strain_Relief', 'SSD_Connector',
]);
/** the lid laid flat: plate and cable in one plane */
const FLAT_LID_DEG = 180;
/** camera: a three-quarter view from above, fitted to what is shown */
const CAM_DIR = new THREE.Vector3(0.55, 0.62, 0.75).normalize();
/** share of the frame the motif fills */
const FILL = 0.8;

export default function RenderCards({ which }: { which: CardMotif }) {
  const [status, setStatus] = useState('rendering…');
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'grid', placeContent: 'center', gap: 16, font: '14px system-ui' }}>
      <div style={{ width: SIZE / 2, height: SIZE / 2, background: 'repeating-conic-gradient(#ececef 0 25%, #fff 0 50%) 0 0 / 28px 28px' }}>
        <Canvas
          dpr={2}
          gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.98 }}
          camera={{ fov: 30, near: 0.01, far: 10 }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <Studio lowPower={false} />
          <Motif which={which} onStatus={setStatus} />
        </Canvas>
      </div>
      <p style={{ margin: 0, textAlign: 'center', color: '#68686d' }}>card-{which} · {status}</p>
    </div>
  );
}

function Motif({ which, onStatus }: { which: CardMotif; onStatus: (s: string) => void }) {
  const macbook = useGLTF('/models/macbook.glb', DRACO);
  const { camera, gl } = useThree();
  const tex = useMemo<Tex>(() => ({ leather: leatherTextures(), grain: grainTexture(), fabric: fabricTexture() }), []);
  const ready = useRef(false);
  const saved = useRef(false);
  const frames = useRef(0);

  const group = useMemo(() => {
    const cfg = stageConfig({ mobile: false });
    const flat = { ...cfg, lidDeg: FLAT_LID_DEG };
    const g = new THREE.Group();
    // the MacBook placed as in the sequence, reduced to plate and cable ...
    const inner = new THREE.Group();
    inner.matrixAutoUpdate = false;
    inner.matrix.copy(macStageMatrix(flat));
    const hinge = macbook.scene.getObjectByName('MacBook_Display_Hinge');
    const cable = macbook.scene.getObjectByName('Cable_Flexible_Fabric') as THREE.Mesh | undefined;
    const lid = macbook.scene.getObjectByName('Display005');
    const base = macbook.scene.getObjectByName('MacBook_BaseCover');
    // ... the cable reshaped for the flat lid (measured at the angle it was modelled for, then bent)
    hinge?.quaternion.copy(hingeQuaternion(cfg.lidDeg));
    if (cable?.isMesh && hinge && lid && base) new CableBend(cable, hinge, lid, base, cfg.lidDeg).update(FLAT_LID_DEG);
    hinge?.quaternion.copy(hingeQuaternion(FLAT_LID_DEG));
    macbook.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.visible = SHOWN.has(o.name); });
    inner.add(macbook.scene);
    g.add(inner);
    // turn the arrangement so the plate lies flat at the origin (where the docked Limpet's centre would be)
    const pos = new THREE.Vector3(), q = new THREE.Quaternion();
    dockedPose('mac', flat, macStageMatrix(flat), phoneStageMatrix(flat), pos, q);
    g.quaternion.copy(q).invert();
    g.position.copy(pos).applyQuaternion(g.quaternion).negate();
    return g;
  }, [macbook]);

  useLayoutEffect(() => {
    // fit: the box of the shown meshes, seen along CAM_DIR
    group.updateMatrixWorld(true);
    const box = new THREE.Box3();
    group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.visible) box.expandByObject(m); });
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    const dist = radius / Math.tan(THREE.MathUtils.degToRad(15)) / FILL;
    camera.position.copy(center).addScaledVector(CAM_DIR, dist);
    camera.lookAt(center);
    const seen = new Map<THREE.Material, THREE.Material>();
    const leather: THREE.MeshPhysicalMaterial[] = [];
    macbook.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const out = list.map((m) => {
        if (!seen.has(m)) seen.set(m, tuneMaterial(m, tex) ?? m);
        const final = seen.get(m)!;
        if (final.name === 'Limpet leather' && !leather.includes(final as THREE.MeshPhysicalMaterial)) leather.push(final as THREE.MeshPhysicalMaterial);
        return final;
      });
      mesh.material = Array.isArray(mesh.material) ? out : out[0];
    });
    leatherFromImage('/images/leather-detail.jpg').then((maps) => {
      for (const m of leather) { m.map = maps.color; m.normalMap = maps.normal; m.roughnessMap = maps.rough; m.needsUpdate = true; }
      frames.current = 0;
      ready.current = true;
    }).catch(() => { ready.current = true; });
  }, [macbook, tex, camera, group]);

  useFrame(() => {
    if (!ready.current || saved.current) return;
    // a few frames after the textures landed, so shaders are compiled and the env map is built
    if (++frames.current < 12) return;
    saved.current = true;
    const canvas = gl.domElement;
    const put = (type: string, ext: string, quality?: number) =>
      new Promise<void>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('no image')); return; }
          fetch(`/__render/card-${which}.${ext}`, { method: 'POST', body: blob }).then((r) => (r.ok ? resolve() : reject(new Error(r.statusText))), reject);
        }, type, quality);
      });
    put('image/png', 'png').then(() => put('image/webp', 'webp', 0.92)).then(() => onStatus('saved to public/images')).catch((e: Error) => onStatus(`failed: ${e.message}`));
  });

  return <primitive object={group} />;
}
