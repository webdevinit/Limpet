/**
 * The WebGL stage: three models in one world, driven by a scroll progress ref.
 * Lazy-loaded so the page shell renders before three.js arrives.
 */
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import {
  createFrame, evaluate, macStageMatrix, phoneStageMatrix, stageConfig, hingeQuaternion, companionState, companionQuat, heroRestQuat, PAIR_HALF, PAIR_DEPTH, R, type Layout, type MagnetPose,
} from './choreography';
import { measureHeroLayout, type HeroLayout } from './heroLayout';
import { AdaptiveResolution } from './AdaptiveResolution';
import { Backdrop } from './Backdrop';
import { Cable, type CableHandle } from './Cable';
import { leatherTextures, leatherFromImage, grainTexture, fabricTexture, type LeatherMaps } from './textures';

export type StageProps = {
  progress: React.MutableRefObject<number>;
  /** pose of a running magnet snap (overrides the scroll pose of the Limpet while it pulls) */
  magnet: React.MutableRefObject<MagnetPose>;
  /** when the Limpet last touched a dock (performance.now; 0 = never) */
  contact: React.MutableRefObject<{ at: number; device: 'mac' | 'phone' }>;
  /** performance.now() at which the intro (Limpet gliding in) started; 0 = not yet */
  intro: React.MutableRefObject<number>;
  /** where the hero copy ends (measured by Stage); bottom 0 = not measured yet */
  heroLayout: React.MutableRefObject<HeroLayout>;
  layout: Layout;
  lowPower: boolean;
  active: boolean;
  onReady: () => void;
  /** optional on-screen perf readout (`?stats=1`) */
  stats?: React.MutableRefObject<HTMLPreElement | null>;
  /** filled by the canvas: requests one frame (the stage renders on demand) */
  invalidate: React.MutableRefObject<(() => void) | null>;
};

const DRACO = '/draco/';
const MODELS = { limpet: '/models/limpet.glb', macbook: '/models/macbook.glb', iphone: '/models/iphone.glb' };

export function preloadModels() {
  useGLTF.preload(MODELS.limpet, DRACO);
  useGLTF.preload(MODELS.macbook, DRACO);
  useGLTF.preload(MODELS.iphone, DRACO);
}

export default function StageCanvas(props: StageProps) {
  // keep rendering until the first frames are drawn, even if the stage is scrolled out of view
  const [warm, setWarm] = useState(false);
  const onReady = useCallback(() => { setWarm(true); props.onReady(); }, [props.onReady]);
  // Some browsers (and device emulations) skip the ResizeObserver's initial callback, which leaves the
  // canvas unmeasured and the renderer never starts. A couple of synthetic resize events nudge the measurement.
  useEffect(() => {
    const kick = () => window.dispatchEvent(new Event('resize'));
    const t1 = setTimeout(kick, 300), t2 = setTimeout(kick, 1500), t3 = setTimeout(kick, 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  return (
    <Canvas
      dpr={[1, props.lowPower ? 1.5 : 2]}
      camera={{ fov: 30, near: 0.01, far: 10, position: [0, 0.02, 0.4] }}
      // opaque canvas: the stage gradient is drawn by <Backdrop/>, so the browser never blends the canvas over the page.
      // three r170 always asks for an alpha context itself, so the context is created here with alpha: false.
      gl={createOpaqueRenderer}
      frameloop={warm ? 'demand' : 'always'}
      style={{ pointerEvents: 'none' }}
    >
      <Backdrop />
      <Suspense fallback={null}>
        <Studio lowPower={props.lowPower} />
        <Models {...props} onReady={onReady} />
        <AdaptiveResolution progress={props.progress} intro={props.intro} introMs={INTRO_MS} lowPower={props.lowPower} stats={props.stats} />
        <InvalidateBridge handle={props.invalidate} />
      </Suspense>
    </Canvas>
  );
}

/** A renderer on an opaque WebGL context (no alpha channel for the compositor to blend). */
function createOpaqueRenderer(canvas: HTMLCanvasElement | OffscreenCanvas) {
  const attrs: WebGLContextAttributes = { alpha: false, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
  const context = (canvas.getContext('webgl2', attrs) ?? canvas.getContext('webgl', attrs)) as WebGL2RenderingContext | WebGLRenderingContext;
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.setClearColor('#f7f7f9', 1);
  return renderer;
}

/** Hands the canvas's `invalidate` to the page (scroll handler, loader) so they can request frames. */
function InvalidateBridge({ handle }: { handle: React.MutableRefObject<(() => void) | null> }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    handle.current = () => invalidate();
    invalidate();
    return () => { handle.current = null; };
  }, [invalidate, handle]);
  return null;
}

/** Soft studio: large, blurred light sources so sandblasted metal shows broad gradients, not streaks. */
function Studio({ lowPower }: { lowPower: boolean }) {
  return (
    <>
      <ambientLight intensity={0.14} />
      <directionalLight position={[0.5, 1.2, 0.8]} intensity={0.7} color="#fff8f0" />
      <directionalLight position={[-0.9, 0.5, 0.3]} intensity={0.3} color="#dfe6f2" />
      <Environment resolution={lowPower ? 128 : 256} frames={1} background={false} blur={0.55}>
        <color attach="background" args={['#b9bcc3']} />
        <Lightformer form="rect" intensity={1.9} position={[0, 2.4, 0.2]} rotation={[-Math.PI / 2, 0, 0]} scale={[4.5, 3.2, 1]} />
        <Lightformer form="rect" intensity={1.0} position={[-2.8, 0.6, 1.2]} rotation={[0, Math.PI / 3, 0]} scale={[1.6, 3.2, 1]} />
        <Lightformer form="rect" intensity={0.7} position={[2.8, 0.2, 1.0]} rotation={[0, -Math.PI / 3, 0]} scale={[1.6, 3.2, 1]} color="#f6efe4" />
        <Lightformer form="rect" intensity={1.2} position={[0, 0.5, 3.2]} scale={[5.5, 3.4, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={0.25} position={[0, -2.4, 0.5]} rotation={[Math.PI / 2, 0, 0]} scale={[5, 3, 1]} color="#9ea3ad" />
        {!lowPower && <Lightformer form="rect" intensity={0.45} position={[0, 1.2, -3]} rotation={[0, Math.PI, 0]} scale={[4, 2.2, 1]} color="#eef0f4" />}
      </Environment>
    </>
  );
}

type Tex = { leather: LeatherMaps; grain: THREE.CanvasTexture; fabric: THREE.CanvasTexture };

/** Returns a replacement material when the original should be swapped (leather), otherwise tunes in place. */
function tuneMaterial(mat: THREE.Material, tex: Tex): THREE.Material | null {
  const s = mat as THREE.MeshStandardMaterial;
  const n = mat.name;
  if (n === 'Limpet aluminium') {
    s.color.set('#dfe0e3'); s.metalness = 0.92; s.roughness = 0.5; s.envMapIntensity = 0.85;
    s.roughnessMap = tex.grain;
  } else if (n === 'Limpet underside') {
    return new THREE.MeshPhysicalMaterial({
      name: 'Limpet leather', color: '#ffffff', map: tex.leather.color, roughness: 0.55, metalness: 0,
      normalMap: tex.leather.normal, normalScale: new THREE.Vector2(1.4, 1.4), roughnessMap: tex.leather.rough,
      sheen: 0.5, sheenRoughness: 0.65, sheenColor: new THREE.Color('#7a7a80'), envMapIntensity: 1.1,
    });
  } else if (n === 'SilverMetalic' || n === 'Silver Metalic.002' || n === 'Aluminium metal') {
    s.color.set('#dfe0e4'); s.metalness = 0.55; s.roughness = 0.5; s.envMapIntensity = 1.0;
    s.roughnessMap = tex.grain;
  } else if (n === 'led') {
    s.color.set('#1fbf5c'); s.emissive.set('#1fdc63'); s.emissiveIntensity = 0; s.metalness = 0; s.roughness = 0.4;
  } else if (n === 'Dock ring') {
    s.color.set('#2a2a2c'); s.roughness = 0.8; s.metalness = 0;
  } else if (n === 'Clear Plastic') {
    s.transparent = true; s.opacity = 0.3; s.roughness = 0.2;
  } else if (/cushion knit|Charcoal/.test(n)) {
    s.color.set('#4f5258'); s.metalness = 0; s.roughness = 0.95; s.bumpMap = tex.fabric; s.bumpScale = 0.0003; s.envMapIntensity = 0.4;
  } else if (/Rubber Black/.test(n)) {
    s.color.set('#141416'); s.roughness = 0.75; s.metalness = 0;
  } else if (n === 'iPhone 16 - Ultramarine aluminium') {
    s.name = 'iPhone frame'; s.color.set('#2e2e30'); s.metalness = 0.75; s.roughness = 0.46; s.envMapIntensity = 0.9;
  } else if (n === 'iPhone 16 - Ultramarine colour-infused glass') {
    s.name = 'iPhone glass'; s.color.set('#303033'); s.metalness = 0.0; s.roughness = 0.46; s.envMapIntensity = 0.9;
  } else if (n === 'iPhone 16 - Ultramarine camera island') {
    s.name = 'iPhone camera island'; s.color.set('#1d1d20'); s.metalness = 0.6; s.roughness = 0.38; s.envMapIntensity = 0.9;
  } else if (n === 'iPhone 16 - blue Apple logo') {
    s.color.set('#4c4c50'); s.metalness = 0.85; s.roughness = 0.3;
  } else if (n === 'iPhone 16 - dark sapphire camera glass') {
    s.color.set('#06070b'); s.metalness = 0.2; s.roughness = 0.06; s.envMapIntensity = 1.4;
  } else if (/Black Plastic|BlackMetalic/.test(n)) {
    s.roughness = Math.max(s.roughness, 0.55);
  }
  s.needsUpdate = true;
  return null;
}

/* ---- resting Limpet in the hero (fitted to the measured copy every frame while the hero is on screen) ---- */
/** gap between the hero button and the top of the Limpet (px) */
const HERO_GAP_PX = 36;
/** the Limpet is about this wide relative to the rendered headline ... */
const HERO_WIDTH_OF_COPY = 0.8;
/** ... and sits so that at most this much of it shows above the first screen's bottom edge (tall windows) ... */
const HERO_MAX_VISIBLE = 0.55;
/** ... but at least this much (short windows shrink it instead) */
const HERO_MIN_VISIBLE = 0.25;
/** the extra air between button and Limpet never grows beyond this share of the viewport height (tall windows) */
const HERO_MAX_AIR = 0.2;
/** on phones the headline is narrow, so the Limpet is sized against the viewport instead */
const HERO_WIDTH_OF_PHONE = 0.68;
/** the float-in from below the screen edge after the loader (ms) */
export const INTRO_MS = 2600;
/** contact feedback (LED flash, camera push) lasts this long (ms) */
const CONTACT_MS = 450;
/** camera push at contact: share of the camera's distance to its target (peak) */
const KICK = 0.012;
const TAN_HALF_FOV = Math.tan(THREE.MathUtils.degToRad(15));
const ONE = new THREE.Vector3(1, 1, 1);

/** the eight corners of a loaded model's bounding box, in the model's own space */
function modelCorners(root: THREE.Object3D): THREE.Vector3[] {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const rel = new THREE.Matrix4();
  const box = new THREE.Box3();
  const b = new THREE.Box3();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    b.copy(mesh.geometry.boundingBox!).applyMatrix4(rel.multiplyMatrices(inv, mesh.matrixWorld));
    box.union(b);
  });
  const c: THREE.Vector3[] = [];
  for (let i = 0; i < 8; i++) c.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  return c;
}

function Models({ progress, magnet, contact, intro, heroLayout, layout, onReady }: StageProps) {
  const limpet = useGLTF(MODELS.limpet, DRACO);
  const macbook = useGLTF(MODELS.macbook, DRACO);
  const iphone = useGLTF(MODELS.iphone, DRACO);

  const limpetRef = useRef<THREE.Group>(null);
  const companionRef = useRef<THREE.Group>(null);
  const companionMats = useRef<THREE.Material[]>([]);
  const macRef = useRef<THREE.Group>(null);
  const macInnerRef = useRef<THREE.Group>(null);
  const phoneRef = useRef<THREE.Group>(null);
  const phoneInnerRef = useRef<THREE.Group>(null);
  const cable = useRef<CableHandle | null>(null);
  const led = useRef<THREE.MeshStandardMaterial | null>(null);
  const leatherMats = useRef<THREE.MeshPhysicalMaterial[]>([]);
  const phoneMats = useRef<THREE.Material[]>([]);
  const hinge = useRef<THREE.Object3D | null>(null);

  const tex = useMemo<Tex>(() => ({ leather: leatherTextures(), grain: grainTexture(), fabric: fabricTexture() }), []);
  const cfg = useMemo(() => stageConfig(layout), [layout.mobile]);
  const macStage = useMemo(() => macStageMatrix(cfg), [cfg]);
  const phoneStage = useMemo(() => phoneStageMatrix(cfg), [cfg]);
  const frame = useMemo(() => createFrame(), []);
  const { camera, size, invalidate } = useThree();
  const heroQ0 = useMemo(() => heroRestQuat(), []);
  const corners = useMemo(() => modelCorners(limpet.scene), [limpet.scene]);
  const restCam = useMemo(() => new THREE.PerspectiveCamera(30, 1, 0.01, 10), []);
  const restM = useMemo(() => new THREE.Matrix4(), []);
  const restV = useMemo(() => new THREE.Vector3(), []);
  /** how far below its resting place the Limpet starts its float-in (m) */
  const introDrop = useRef(0.4);
  /** true while the hero fit is still correcting by more than half a pixel (keeps on-demand frames coming) */
  const fitSettling = useRef(false);
  const camPos = useRef(new THREE.Vector3().copy(camera.position));
  const camTarget = useRef(new THREE.Vector3());
  const introQ = useMemo(() => new THREE.Quaternion(), []);
  const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const kickDir = useMemo(() => new THREE.Vector3(), []);
  const compQuat = useMemo(() => companionQuat(), []);
  // Scene 4 companion: a second instance of the shell showing the leather side (own materials so it can fade in)
  const companion = useMemo(() => {
    const c = limpet.scene.clone(true);
    const cloned = new Map<THREE.Material, THREE.Material>();
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const out = list.map((m) => { if (!cloned.has(m)) { const cm = m.clone(); cm.transparent = true; cm.opacity = 0; cloned.set(m, cm); } return cloned.get(m)!; });
      mesh.material = Array.isArray(mesh.material) ? out : out[0];
    });
    companionMats.current = [...cloned.values()];
    return c;
  }, [limpet]);

  useLayoutEffect(() => {
    const seen = new Map<THREE.Material, THREE.Material>();
    const walk = (root: THREE.Object3D, collect?: THREE.Material[]) =>
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const out = list.map((m) => {
          if (!seen.has(m)) seen.set(m, tuneMaterial(m, tex) ?? m);
          const final = seen.get(m)!;
          if (final.name === 'led') led.current = final as THREE.MeshStandardMaterial;
          if (final.name === 'Limpet leather' && !leatherMats.current.includes(final as THREE.MeshPhysicalMaterial)) leatherMats.current.push(final as THREE.MeshPhysicalMaterial);
          collect?.push(final);
          return final;
        });
        mesh.material = Array.isArray(mesh.material) ? out : out[0];
      });
    walk(limpet.scene);
    walk(companion);
    walk(macbook.scene);
    phoneMats.current = [];
    walk(iphone.scene, phoneMats.current);
    hinge.current = macbook.scene.getObjectByName('MacBook_Display_Hinge') ?? null;
    hinge.current?.quaternion.copy(hingeQuaternion(cfg.lidDeg));
    if (import.meta.env.DEV) (window as unknown as { __limpetScene?: unknown }).__limpetScene = { limpet: limpet.scene, macbook: macbook.scene, iphone: iphone.scene, camera, phone: phoneRef.current, limpetGroup: limpetRef.current };
    // swap the procedural leather for the real grain from the handover render once it has loaded
    let cancelled = false;
    leatherFromImage('/images/leather-detail.jpg').then((maps) => {
      if (cancelled) return;
      for (const m of leatherMats.current) {
        m.map = maps.color; m.normalMap = maps.normal; m.roughnessMap = maps.rough;
        m.color.set('#9c9ca2'); m.roughness = 0.5; m.normalScale.set(1.3, 1.3); m.sheen = 0.7; m.sheenRoughness = 0.6; m.sheenColor.set('#8c8c92'); m.envMapIntensity = 1.4; m.needsUpdate = true;
      }
      invalidate();
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [limpet, macbook, iphone, cfg, tex]);

  useLayoutEffect(() => {
    if (macInnerRef.current) { macInnerRef.current.matrixAutoUpdate = false; macInnerRef.current.matrix.copy(macStage); }
    if (phoneInnerRef.current) { phoneInnerRef.current.matrixAutoUpdate = false; phoneInnerRef.current.matrix.copy(phoneStage); }
  }, [macStage, phoneStage]);

  // Report "ready" only after the first frames have actually been drawn (shaders compiled), so the loader
  // never reveals an empty stage.
  const framesDrawn = useRef(0);
  const readyFired = useRef(false);
  const fireReady = () => { if (!readyFired.current) { readyFired.current = true; onReady(); } };
  // fallback: if frames cannot be drawn for a while (heavy paints elsewhere), release the loader anyway
  useEffect(() => { const t = setTimeout(fireReady, 2500); return () => clearTimeout(t); }, []);
  useFrame((_, dt) => {
    framesDrawn.current++;
    if (framesDrawn.current === 3) fireReady();
    // resting pose on every viewport: below the hero copy and inside the first screen. Short windows would
    // otherwise push the Limpet into the button; if copy + Limpet do not fit at all, the hero camera backs off.
    // belt and braces: measure the hero copy ourselves until Stage has reported it (no layout reads per frame after that)
    if (heroLayout.current.bottom === 0 && typeof document !== 'undefined') {
      const copy = document.querySelector<HTMLElement>('.stage .ob-top');
      const track = document.querySelector<HTMLElement>('.stage-track');
      if (copy && track) heroLayout.current = measureHeroLayout(track, copy);
    }
    // resting pose: project the Limpet's box through the hero camera and fit it to the copy: about 80 % of the
    // headline's width, top just under the button, the lower part below the first screen's bottom edge.
    // Camera distance and height are corrected a little every frame, so any viewport converges within a few frames.
    const hl = heroLayout.current;
    if (hl.bottom > 0 && hl.width > 0 && size.height > 0 && progress.current < R.hero[1]) {
      const H = size.height;
      let dist = cfg.cams[0].pos.z;
      restCam.aspect = size.width / H;
      restCam.updateProjectionMatrix();
      restCam.position.set(0, 0.02, dist);
      restCam.lookAt(0, cfg.heroCamY, 0);
      restCam.updateMatrixWorld();
      restM.compose(restV.set(0, cfg.heroPos.y, 0), heroQ0, ONE);
      let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
      for (const c of corners) {
        restV.copy(c).applyMatrix4(restM).project(restCam);
        const x = (restV.x + 1) / 2 * size.width, y = (1 - restV.y) / 2 * H;
        top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x);
      }
      const wPx = right - left, hPx = bottom - top;
      const screenBottom = H - hl.stageTop; // first screen's bottom edge, in stage px
      const topUnderCopy = hl.bottom + HERO_GAP_PX;
      if (wPx > 1 && hPx > 1) {
        const maxH = Math.max(40, screenBottom - topUnderCopy) / HERO_MIN_VISIBLE;
        const wantW = Math.max(HERO_WIDTH_OF_COPY * hl.width, layout.mobile ? HERO_WIDTH_OF_PHONE * size.width : 0);
        const targetW = Math.min(wantW, maxH * (wPx / hPx));
        dist = THREE.MathUtils.clamp(dist * (wPx / targetW), 0.09, cfg.heroCamDist);
        cfg.cams[0].pos.z = cfg.cams[1].pos.z = dist;
        const desiredTop = THREE.MathUtils.clamp(screenBottom - HERO_MAX_VISIBLE * hPx, topUnderCopy, topUnderCopy + HERO_MAX_AIR * H);
        const pxPerM = H / (2 * dist * TAN_HALF_FOV);
        const yBefore = cfg.heroPos.y;
        cfg.heroPos.y = THREE.MathUtils.clamp(cfg.heroPos.y - (desiredTop - top) / pxPerM, -0.6, 0.1);
        introDrop.current = Math.max(0.05, (screenBottom - top) / pxPerM + 0.05);
        fitSettling.current = Math.abs(cfg.heroPos.y - yBefore) * pxPerM > 0.5 || Math.abs(wPx - targetW) > 0.5;
        if (import.meta.env.DEV && framesDrawn.current % 30 === 0) {
          (window as unknown as { __limpetDebug?: unknown }).__limpetDebug = { hl: { ...hl }, size: { w: size.width, h: H }, dist, heroPosY: cfg.heroPos.y, top, bottom, left, right, wPx, hPx, targetW, desiredTop, introDrop: introDrop.current, limpetY: limpetRef.current?.position.y, camZ: camera.position.z };
        }
      }
    }
    const f = evaluate(progress.current, cfg, macStage, phoneStage, frame, magnet.current);
    const L = limpetRef.current, M = macRef.current, P = phoneRef.current;
    if (L) {
      L.position.copy(f.limpetPos); L.quaternion.copy(f.limpetQuat);
      if (progress.current < R.hero[1]) {
        // floats up from below the screen edge once the loader fades, slow and smooth, turning gently as it settles;
        // until the intro starts it waits fully below the edge, so it never shows at rest first
        const e = intro.current > 0 ? Math.min(1, (performance.now() - intro.current) / INTRO_MS) : 0;
        const k = 1 - Math.pow(1 - e, 4);
        L.position.y += (1 - k) * -introDrop.current;
        introQ.setFromAxisAngle(yAxis, (1 - k) * -0.45);
        L.quaternion.premultiply(introQ);
      }
    }
    const Cp = companionRef.current;
    if (Cp) {
      const c = companionState(progress.current);
      Cp.visible = c.o > 0.001;
      Cp.position.set(-PAIR_HALF - c.drift, cfg.finalPos.y, -PAIR_DEPTH); // left of centre, behind, drifting in from the left
      Cp.quaternion.copy(compQuat); // mirrored tilt, leather side to the camera
      Cp.scale.setScalar(c.s);
      for (const m of companionMats.current) if (Math.abs(m.opacity - c.o) > 0.001) m.opacity = c.o;
    }
    if (M) { M.visible = f.macVisible; M.position.copy(f.macOffset); }
    if (P) {
      P.visible = f.phoneVisible; P.position.copy(f.phoneOffset);
      const op = f.phoneOpacity;
      for (const m of phoneMats.current) {
        const needs = op < 1;
        if (m.transparent !== needs || Math.abs(m.opacity - op) > 0.001) { m.transparent = needs; m.opacity = op; }
      }
    }
    // contact: the LED flashes once as the magnets catch, then settles to its normal glow
    const since = contact.current.at ? performance.now() - contact.current.at : Infinity;
    const flash = since < CONTACT_MS ? Math.exp(-since / 110) : 0;
    if (led.current) led.current.emissiveIntensity = f.limpetPowered * 2.5 + flash * 4;
    cable.current?.update(f.connectorPos, f.connectorDir, f.connectorUp, f.phoneOpacity);

    const k = 1 - Math.exp(-dt * 7);
    camPos.current.lerp(f.camPos, k);
    camTarget.current.lerp(f.camTarget, k);
    camera.position.copy(camPos.current);
    // contact: a short push towards the dock, gone again within a quarter second (felt more than seen)
    if (since < CONTACT_MS) {
      const push = (Math.exp(-since / 80) - Math.exp(-since / 14)) * KICK;
      kickDir.subVectors(camTarget.current, camPos.current);
      camera.position.addScaledVector(kickDir, push);
    }
    camera.lookAt(camTarget.current);

    // on-demand rendering: keep frames coming only while something is still in motion on its own
    const introActive = intro.current > 0 && performance.now() - intro.current < INTRO_MS + 50;
    const camSettling = camPos.current.distanceToSquared(f.camPos) > 1e-9 || camTarget.current.distanceToSquared(f.camTarget) > 1e-9;
    if (introActive || camSettling || fitSettling.current || since < CONTACT_MS) invalidate();
  });

  return (
    <>
      <group ref={limpetRef}>
        <primitive object={limpet.scene} />
      </group>
      <group ref={companionRef} visible={false}>
        <primitive object={companion} />
      </group>
      <group ref={macRef}>
        <group ref={macInnerRef}>
          <primitive object={macbook.scene} />
        </group>
      </group>
      <group ref={phoneRef}>
        <group ref={phoneInnerRef}>
          <primitive object={iphone.scene} />
          <Cable handleRef={cable} />
        </group>
      </group>
    </>
  );
}
