/**
 * Two extra Limpets in the start screen (laptop-sized screens and up): one sticking out of the left edge, one out of
 * the right, each turned differently in space. They float in with the intro and fly out past the edges, turning, as
 * soon as the visitor scrolls.
 *
 * Cheap by construction: they are clones of the hero Limpet that share its geometry and materials (no extra
 * textures or shader programs), and they are switched off entirely once they have left, so the rest of the sequence
 * renders exactly as before.
 */
import * as THREE from 'three';
import { span, easeIn } from './choreography';

/** from this viewport width (px) on, and never on phones */
export const SIDES_MIN_WIDTH = 1024;
/** scroll progress over which they leave (they are gone, and hidden, after the end) */
export const SIDES_EXIT: [number, number] = [0.002, 0.065];
/** the float-in starts this much later than the hero Limpet's (ms, per side), so the three arrive staggered */
export const SIDES_DELAY_MS = [220, 380];

type Side = {
  /** -1 left, +1 right */
  dir: -1 | 1;
  /** how far the centre sits inside the edge, in Limpet widths (0 = centre on the edge) */
  inset: number;
  /** height of the centre relative to the look-at point, in half screen heights (negative = lower) */
  fy: number;
  /** depth offset (m, + towards the camera) */
  z: number;
  /** size relative to the hero Limpet */
  scale: number;
  /** resting orientation */
  rot: THREE.Euler;
  /** extra turn while leaving (radians per axis) */
  exitTurn: THREE.Vector3;
};

export const SIDES: Side[] = [
  // left: leaning back and away, the leather side half towards the camera
  { dir: -1, inset: 0.18, fy: -0.12, z: 0.04, scale: 0.68, rot: new THREE.Euler(-0.55, 2.45, 0.85), exitTurn: new THREE.Vector3(0.5, -1.6, 0.4) },
  // right: tipped forward and twisted the other way, shell side showing
  { dir: 1, inset: 0.12, fy: -0.08, z: -0.05, scale: 0.78, rot: new THREE.Euler(1.2, -0.75, -0.55), exitTurn: new THREE.Vector3(-0.7, 1.3, -0.5) },
];

const TAN_HALF_FOV = Math.tan(THREE.MathUtils.degToRad(15));

export type SideFrame = {
  /** hero camera distance (fitted) and look-at height */
  camDist: number;
  lookY: number;
  aspect: number;
  /** Limpet width (m) */
  width: number;
  progress: number;
  /** intro: ms since it started (< 0 = not yet), its length, and how far below the edge the Limpets start (m) */
  introMs: number;
  introLen: number;
  drop: number;
};

/** places one side Limpet; returns false when it is off (left already, or not shown on this screen) */
export function placeSide(obj: THREE.Object3D, i: number, fr: SideFrame) {
  const s = SIDES[i];
  const leave = span(fr.progress, SIDES_EXIT);
  if (leave >= 1) { obj.visible = false; return false; }
  obj.visible = true;
  // the screen's half extent at the Limpet's depth
  const d = fr.camDist - s.z;
  const halfH = d * TAN_HALF_FOV;
  const halfW = halfH * fr.aspect;
  const e = easeIn(leave);
  const w = fr.width * s.scale;
  obj.scale.setScalar(s.scale);
  // float-in: from below the edge, staggered, with a gentle turn as it settles (same easing as the hero Limpet)
  const t = fr.introMs < 0 ? 0 : Math.min(1, Math.max(0, (fr.introMs - SIDES_DELAY_MS[i]) / fr.introLen));
  const k = 1 - Math.pow(1 - t, 4);
  obj.position.set(
    s.dir * (halfW - s.inset * w + e * (halfW * 0.55 + w)),
    fr.lookY + s.fy * halfH + e * 0.2 * halfH - (1 - k) * fr.drop,
    s.z,
  );
  obj.rotation.set(
    s.rot.x + e * s.exitTurn.x,
    s.rot.y + e * s.exitTurn.y + (1 - k) * 0.5 * s.dir,
    s.rot.z + e * s.exitTurn.z,
  );
  return true;
}
