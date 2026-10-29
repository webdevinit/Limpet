/**
 * Pure scroll choreography for the product sequence.
 *
 * progress p ∈ [0,1] over the sticky stage:
 *   Scene 1  product alone, turning                       0.00 – 0.18
 *   Scene 2  MacBook enters; Limpet lowers onto the lid
 *            left of the dock plate and slides into the
 *            dock's USB-C plug (right)                     0.18 – 0.52
 *   ↘        slides out, lifts off, MacBook leaves         0.52 – 0.70
 *   Scene 3  iPhone enters with its cable; Limpet plugs
 *            onto the connector, flips over the edge and
 *            snaps to the MagSafe area                     0.64 – 0.92
 *   Scene 4  iPhone recedes, Limpet settles                0.92 – 1.00
 *
 * Everything is a function of p, so scrolling back plays the transitions in reverse.
 * Units are metres; the models share one world (Y up, camera on +Z).
 *
 * Canonical Limpet frame: X width, Y thickness (top at +Y), Z length with the USB tray at +Z.
 * The dock plate's plug points along -Z, so the Limpet engages by moving along +Z.
 */
import * as THREE from 'three';
import rigIphone from './rig-iphone.json';
import rigMac from './rig-macbook.json';

export type Layout = { mobile: boolean };

export const R = {
  /** as the title fades, the Limpet moves from under the hero copy to the centre of the frame while the camera closes in */
  heroCenter: [0.01, 0.13],
  hero: [0.0, 0.18],
  macEnter: [0.18, 0.3],
  limpetToMac: [0.2, 0.34],
  tiltDown: [0.34, 0.4],   // right (tray) end tilts down onto the lid, the plug threads in
  settle: [0.4, 0.47],     // left end comes down while the Limpet snaps 12 mm to the right
  dockHold: [0.47, 0.52],
  unsettle: [0.52, 0.57],
  lift: [0.57, 0.61],
  macExit: [0.57, 0.68],
  orientToPhone: [0.575, 0.66], // the Limpet starts turning into its iPhone pose the moment it lifts off
  cableSwing: [0.62, 0.7],      // the hanging cable swings towards the waiting pose while the phone settles
  limpetToPhone: [0.61, 0.76],  // one continuous curve that ends seated on the cable connector
  phoneEnter: [0.61, 0.7],      // arrives only once the Limpet is well in front of it
  flip: [0.8, 0.9],
  phoneHold: [0.9, 0.92],
  phoneOut: [0.92, 0.97],
  final: [0.92, 1.0],
} as const;

export const SNAP = 0.007; // metres the Limpet snaps right (along the plug axis) while settling
export const HOVER = 0.035; // hover height above the lid before tilting down
export const PERCH = 0.0075; // pivot height while tilted: the tray end rests just above the dock's cable roof
export const LIFT = 0.04; // the Limpet lifts quickly off the plate (room to turn) before heading straight for the iPhone cable
export const TILT = 0.3; // radians: tray end down
export const DOCK_NUDGE = 0.0022; // metres up the lid (canonical +X) so the shell reads as sitting exactly on the plate
const HALF_LEN = 0.048; // Limpet half length (pivot at the tray end)
export const PLUG = 0.035; // metres: the approach curve's control point sits this far off the connector, along its axis

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const span = (p: number, [a, b]: readonly [number, number] | readonly number[]) => clamp01((p - a) / (b - a));
export const easeInOut = (s: number) => (s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2);
export const easeOut = (s: number) => 1 - Math.pow(1 - s, 3);
export const easeIn = (s: number) => s * s * s;
export const smooth = (s: number) => s * s * (3 - 2 * s);

// ---------------------------------------------------------------- magnets
/**
 * Magnetic release (scroll-driven undocking): the shell clings for the first part of the move, then breaks free.
 * x = 0 docked … 1 fully released; returns how far the pose has actually moved.
 */
export const release = (x: number) => (x < 0.4 ? 0.06 * (x / 0.4) ** 2 : 0.06 + 0.94 * easeOut((x - 0.4) / 0.6));
/** docked end of a scroll-driven range: the inverse direction of `release` (s = 0 far … 1 docked) */
const cling = (s: number) => 1 - release(1 - s);

/** share of the MacBook approach (tilt down + settle) taken by the tilt */
const KT = (R.tiltDown[1] - R.tiltDown[0]) / (R.settle[1] - R.tiltDown[0]);
/** iPhone flip: how far the Limpet has swung onto the back at scroll progress p (0 under the phone … 1 on MagSafe) */
export const flipT = (p: number) => cling(span(p, R.flip));

export type MagnetId = 'mac-in' | 'mac-out' | 'phone-in';
/**
 * A place where the Limpet snaps on by itself. `param(p)` is the pose along the snap path for scroll progress p
 * (0 far … 1 docked). Moving towards `dock` with the pose past `trigger`, the magnet takes over and pulls the Limpet
 * home on a timed curve; the zone arms again only once the pose is back below `rearm` (no flutter at the threshold).
 */
export type MagnetZone = { id: MagnetId; device: 'mac' | 'phone'; far: number; dock: number; trigger: number; rearm: number; param: (p: number) => number };

export const MAGNETS: MagnetZone[] = [
  {
    // forward onto the MacBook: the tray end has just started to tip onto the plate
    id: 'mac-in', device: 'mac', far: R.tiltDown[0], dock: R.settle[1], trigger: 0.15, rearm: 0.02,
    param: (p) => (p <= R.tiltDown[0] ? 0 : p >= R.settle[1] ? 1 : p < R.tiltDown[1] ? KT * easeInOut(span(p, R.tiltDown)) : KT + (1 - KT) * cling(span(p, R.settle))),
  },
  {
    // back onto the MacBook from the iPhone side (scrolling up)
    id: 'mac-out', device: 'mac', far: R.unsettle[1], dock: R.unsettle[0], trigger: 0.3, rearm: 0.03,
    param: (p) => (p <= R.unsettle[0] ? 1 : p >= R.unsettle[1] ? 0 : 1 - release(span(p, R.unsettle))),
  },
  {
    // onto the iPhone's MagSafe area: a third of the way through the flip
    id: 'phone-in', device: 'phone', far: R.flip[0], dock: R.flip[1], trigger: 0.3, rearm: 0.03,
    param: (p) => flipT(p),
  },
];

/** A running snap: the pose `k` along the zone's path (linear, the timing comes from the magnet curve). */
export type MagnetPose = { id: MagnetId | null; k: number; contact: boolean };
export const noMagnet = (): MagnetPose => ({ id: null, k: 0, contact: false });

export function activeScene(p: number): 0 | 1 | 2 | 3 {
  if (p < 0.18) return 0;
  if (p < 0.6) return 1;
  if (p < 0.92) return 2;
  return 3;
}

export function textState(p: number): { o: number; y: number }[] {
  const fade = (inA: number, inB: number, outA: number, outB: number) => {
    const i = smooth(span(p, [inA, inB]));
    const o = 1 - smooth(span(p, [outA, outB]));
    const v = Math.min(i, o);
    return { o: v, y: (1 - i) * 18 + (1 - o) * -18 };
  };
  return [
    fade(-1, -0.5, 0.01, 0.07),
    fade(0.27, 0.33, 0.55, 0.6),
    fade(0.74, 0.79, 0.9, 0.93),
    fade(0.95, 0.985, 2, 3),
  ];
}

/** Scene-4 companion render (leather side, a plane beside and just behind the 3D model): opacity and drift. */
export function companionState(p: number): { o: number; drift: number; s: number } {
  const i = smooth(span(p, [0.93, 0.985]));
  return { o: i, drift: (1 - i) * 0.05, s: 0.96 + i * 0.04 };
}
/** Half the gap between the two Limpets in the final pair (metres). */
export const PAIR_HALF = 0.026;

// ---------------------------------------------------------------- stage configuration
const tmpM = new THREE.Matrix4();
const q90 = new THREE.Quaternion().fromArray(rigMac.hingeRotation90 as number[]);
const canonToHinge = new THREE.Matrix4().fromArray(rigMac.matrix as number[]);
const hingeT = new THREE.Vector3().fromArray(rigMac.hingeLocalTranslation as number[]);
export const LID_DEG = (rigMac as { lidDeg?: number }).lidDeg ?? 100;

export function hingeQuaternion(lidDeg: number, out = new THREE.Quaternion()) {
  const delta = THREE.MathUtils.degToRad(90 - lidDeg);
  out.setFromAxisAngle(new THREE.Vector3(0, 0, 1), delta);
  return out.premultiply(q90);
}

export type StageConfig = {
  /** resting position under the hero copy; y is fitted at runtime to the measured copy (see StageCanvas) */
  heroPos: THREE.Vector3;
  heroCamY: number;
  /** farthest the hero camera goes while resting (the fit brings it much closer) */
  heroCamDist: number;
  heroCenter: THREE.Vector3;
  finalPos: THREE.Vector3;
  macYaw: number;
  macDockPoint: THREE.Vector3;
  phonePos: THREE.Vector3;
  phoneQuat: THREE.Quaternion;
  cams: { p: number; pos: THREE.Vector3; target: THREE.Vector3 }[];
  lidDeg: number;
};

export function stageConfig(layout: Layout): StageConfig {
  const m = layout.mobile;
  const dist = m ? 1.42 : 1;
  const xo = m ? 0 : 1;
  const yo = m ? 0.015 : 0;
  const ty = m ? -0.045 : 0;
  // phone stands with its back to the camera, turned a little and leaning back (top away from the camera)
  const phoneQuat = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.32)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 - 0.24))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.06));
  const cam = (p: number, pos: [number, number, number], target: [number, number, number], extra = 1) => ({
    p,
    pos: new THREE.Vector3(pos[0], pos[1], pos[2] * dist * (m ? extra : 1)),
    target: new THREE.Vector3(target[0] * xo, target[1] + yo + ty, target[2]),
  });
  return {
    // hero copy sits centred at the top of the viewport, the Limpet underneath it
    heroPos: new THREE.Vector3(0, -0.06 + yo, 0),
    heroCamY: -0.01 + yo + ty,
    heroCamDist: 0.55 * dist,
    heroCenter: new THREE.Vector3(0, 0.0 + yo + ty, 0),
    finalPos: new THREE.Vector3(PAIR_HALF, 0.06 + yo, 0),
    macYaw: Math.PI - 0.95,
    macDockPoint: new THREE.Vector3(0.13 * xo, 0.0 + yo, 0.03),
    phonePos: new THREE.Vector3(0.085 * xo, (m ? 0.085 : 0.03) + yo, 0),
    phoneQuat,
    lidDeg: LID_DEG,
    cams: [
      cam(0.0, [0, 0.02, 0.55], [0, -0.01, 0]),
      cam(0.01, [0, 0.02, 0.55], [0, -0.01, 0]),
      cam(0.14, [0, 0.0, 0.37], [0, -0.01, 0]),
      cam(0.28, [0.0, 0.12, 0.7], [0.07, 0.05, 0], 1.25),
      cam(0.58, [0.03, 0.11, 0.66], [0.07, 0.05, 0], 1.25),
      cam(0.7, [0.0, 0.13, 0.64], [0.04, 0.0, 0], 1.12),
      // docking on the iPhone: the camera closes in on phone and Limpet so they fill the frame, then holds
      cam(0.8, [m ? 0 : 0.02, 0.1, 0.5], [0.06, 0.012, 0], 1.26), // phones: a gentler, centred zoom (the copy sits underneath)
      cam(0.91, [m ? 0 : 0.02, 0.1, 0.48], [0.06, 0.022, 0], 1.28),
      cam(0.98, [0, 0.04, 0.5], [0, 0.0, 0]),
      cam(1.0, [0, 0.04, 0.5], [0, 0.0, 0]),
    ],
  };
}

export function macStageMatrix(cfg: StageConfig, out = new THREE.Matrix4()) {
  const dock = macDockLocal(cfg.lidDeg, tmpM);
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), cfg.macYaw);
  const tDock = new THREE.Vector3().setFromMatrixPosition(dock).applyQuaternion(yaw);
  const pos = cfg.macDockPoint.clone().sub(tDock);
  return out.compose(pos, yaw, new THREE.Vector3(1, 1, 1));
}

export function macDockLocal(lidDeg: number, out = new THREE.Matrix4()) {
  const hq = hingeQuaternion(lidDeg);
  out.compose(hingeT, hq, new THREE.Vector3(1, 1, 1));
  return out.multiply(canonToHinge);
}

export function phoneStageMatrix(cfg: StageConfig, out = new THREE.Matrix4()) {
  return out.compose(cfg.phonePos, cfg.phoneQuat, new THREE.Vector3(1, 1, 1));
}

// ---------------------------------------------------------------- iPhone rig track
type Key = { t: number; p: number[]; q: number[] };
const keys = rigIphone.keys as Key[];
const kp0 = new THREE.Vector3();
const kp1 = new THREE.Vector3();
const kq0 = new THREE.Quaternion();
const kq1 = new THREE.Quaternion();

/**
 * Owner's attach track (rig space). The site uses its second half: the Limpet rests at 90° to the
 * phone (horizontal under the bottom edge, leather up, tray end under the port), is pushed onto the
 * cable connector there, and then swings up onto the back. Two adjustments on top of the rig:
 *  - the resting pose sits a little lower than the rig's 90° key so the cable shows between port and tray,
 *  - the docked pose sits further down the back so the tray rim is flush with the phone's bottom edge
 *    (centred under the camera; the cable leaves the tray exactly at the edge).
 */
const REST_P = new THREE.Vector3(0, 0.075, 0.098);
const DOCK_SHIFT = new THREE.Vector3(0, 0.0011, 0.003); // +1.1 mm off the glass leaves room for the flat cable underneath
const RIG_FROM = 0.5; // rig time of the 90° key
const restRigP = new THREE.Vector3();
const restRigQ = new THREE.Quaternion();
const restOffset = new THREE.Vector3();
let restInit = false;

function sampleRig(u: number, outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
  u = clamp01(u);
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].t <= u) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const s = b.t === a.t ? 0 : clamp01((u - a.t) / (b.t - a.t));
  kp0.fromArray(a.p); kp1.fromArray(b.p);
  kq0.fromArray(a.q); kq1.fromArray(b.q);
  outPos.lerpVectors(kp0, kp1, s);
  outQuat.slerpQuaternions(kq0, kq1, s);
}

/** Limpet pose in rig space, t = 0 resting (90°) … 1 docked. */
export function rigPose(t: number, outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
  if (!restInit) { sampleRig(RIG_FROM, restRigP, restRigQ); restOffset.subVectors(REST_P, restRigP); restInit = true; }
  t = clamp01(t);
  sampleRig(RIG_FROM + (1 - RIG_FROM) * t, outPos, outQuat);
  const w = 1 - smooth(t);
  outPos.addScaledVector(restOffset, w);
  outPos.addScaledVector(DOCK_SHIFT, smooth(t));
}

export const PHONE_PORT = new THREE.Vector3().fromArray(rigIphone.phonePort as number[]);
export const LIMPET_CONNECTOR_LOCAL = new THREE.Vector3().fromArray(rigIphone.limpetConnectorLocal as number[]);

// ---------------------------------------------------------------- per-frame evaluation
export type Frame = {
  limpetPos: THREE.Vector3;
  limpetQuat: THREE.Quaternion;
  limpetPowered: number;
  macVisible: boolean;
  macOffset: THREE.Vector3;
  phoneVisible: boolean;
  phoneOffset: THREE.Vector3;
  phoneOpacity: number;
  rigT: number;
  /** iPhone cable connector (rig space): position of the seated connector and the direction it faces (into the Limpet's tray = Limpet local +Z) */
  connectorPos: THREE.Vector3;
  connectorDir: THREE.Vector3;
  /** Limpet local +Y (dome side) in rig space — the cable leaves the tray on the opposite (leather) side */
  connectorUp: THREE.Vector3;
  camPos: THREE.Vector3;
  camTarget: THREE.Vector3;
};

export function createFrame(): Frame {
  return {
    limpetPos: new THREE.Vector3(),
    limpetQuat: new THREE.Quaternion(),
    limpetPowered: 0,
    macVisible: false,
    macOffset: new THREE.Vector3(),
    phoneVisible: false,
    phoneOffset: new THREE.Vector3(),
    phoneOpacity: 1,
    rigT: 0,
    connectorPos: new THREE.Vector3(),
    connectorDir: new THREE.Vector3(0, 0, -1),
    connectorUp: new THREE.Vector3(0, 1, 0),
    camPos: new THREE.Vector3(),
    camTarget: new THREE.Vector3(),
  };
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vS = new THREE.Vector3();
const vP = new THREE.Vector3();
const vF = new THREE.Vector3();
const vC = new THREE.Vector3();
const qC = new THREE.Quaternion();
const qB = new THREE.Quaternion();
const qT = new THREE.Quaternion();
const qP = new THREE.Quaternion();
const mA = new THREE.Matrix4();
const mB = new THREE.Matrix4();
const mP = new THREE.Matrix4();
const one = new THREE.Vector3(1, 1, 1);
const heroTilt = new THREE.Quaternion().setFromAxisAngle(X, THREE.MathUtils.degToRad(80));

/** the resting Limpet faces the camera almost squarely, then turns ~330 degrees over the hero range */
const HERO_YAW0 = -0.3;
export function heroRestQuat(out = new THREE.Quaternion()) {
  return out.setFromAxisAngle(Y, HERO_YAW0).multiply(heroTilt);
}

function heroPose(p: number, cfg: StageConfig, outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
  const s = span(p, R.hero);
  const yaw = HERO_YAW0 + s * Math.PI * 2 * 0.92;
  outQuat.setFromAxisAngle(Y, yaw).multiply(heroTilt);
  outPos.copy(cfg.heroPos).lerp(cfg.heroCenter, smooth(span(p, R.heroCenter)));
  outPos.y += Math.sin(s * Math.PI * 2) * 0.004;
}

const FINAL_YAW = -0.28; // the dome-side Limpet (right) turns slightly towards the centre
function finalPose(cfg: StageConfig, outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
  outQuat.setFromAxisAngle(Y, FINAL_YAW).multiply(heroTilt);
  outPos.copy(cfg.finalPos);
}
/**
 * Orientation of the companion shell (left): the exact left/right mirror of the final pose, but with the
 * leather side to the camera — same backward lean, tray end down, turned towards the centre.
 */
const Zax = new THREE.Vector3(0, 0, 1);
export function companionQuat(out = new THREE.Quaternion()) {
  const flip = new THREE.Quaternion().setFromAxisAngle(Zax, Math.PI);
  const lean = new THREE.Quaternion().setFromAxisAngle(X, -THREE.MathUtils.degToRad(80));
  return out.setFromAxisAngle(Y, -FINAL_YAW).multiply(flip).multiply(lean);
}
/** Depth offset of the companion (metres behind the stage plane) so the two shells never intersect. */
export const PAIR_DEPTH = 0.035;

/**
 * Limpet world pose relative to the (stage-positioned) MacBook dock.
 * slide: offset along the plug axis (+Z engages), lift: the tray end's height above the lid,
 * theta: tilt about the width axis with the tray end as pivot (positive = tray end down, other end up).
 */
const mT = new THREE.Matrix4();
const mR = new THREE.Matrix4();
function macPose(slide: number, lift: number, theta: number, macStage: THREE.Matrix4, cfg: StageConfig, outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
  macDockLocal(cfg.lidDeg, mA);
  mB.makeTranslation(DOCK_NUDGE, lift, slide + HALF_LEN);
  mR.makeRotationX(theta);
  mT.makeTranslation(0, 0, -HALF_LEN);
  mA.multiply(mB).multiply(mR).multiply(mT).premultiply(macStage);
  mA.decompose(outPos, outQuat, vS);
}

/** Limpet world pose on the iPhone rig at rig time t, backed off the cable connector by `plug` metres. Also records the connector in rig space. */
function phonePose(t: number, plug: number, phoneStage: THREE.Matrix4, outPos: THREE.Vector3, outQuat: THREE.Quaternion, f: Frame) {
  rigPose(t, vP, qP);
  vF.copy(Z).applyQuaternion(qP); // Limpet local +Z (tray end) in rig space
  f.connectorPos.copy(LIMPET_CONNECTOR_LOCAL).applyQuaternion(qP).add(vP);
  f.connectorDir.copy(vF);
  f.connectorUp.copy(Y).applyQuaternion(qP);
  vP.addScaledVector(vF, -plug);
  mP.compose(vP, qP, one).premultiply(phoneStage);
  mP.decompose(outPos, outQuat, vS);
}

/** The Limpet's world pose when docked on a device (stage space, without the device's entry / exit offset). */
const dockScratch = createFrame();
export function dockedPose(device: 'mac' | 'phone', cfg: StageConfig, macStage: THREE.Matrix4, phoneStage: THREE.Matrix4, outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
  if (device === 'mac') macPose(0, 0, 0, macStage, cfg, outPos, outQuat);
  else phonePose(1, 0, phoneStage, outPos, outQuat, dockScratch);
}

/** How close the Limpet is to each dock surface at progress p (0 away … 1 seated); drives the contact shadow. */
export function dockProximity(p: number, mag: MagnetPose | undefined): { mac: number; phone: number } {
  const byId = (id: MagnetId) => MAGNETS.find((z) => z.id === id)!;
  let mac = p < R.unsettle[0] ? byId('mac-in').param(p) : byId('mac-out').param(p);
  let phone = byId('phone-in').param(p) * (1 - smooth(span(p, [R.final[0], R.final[0] + 0.03])));
  if (mag?.id === 'mac-in' || mag?.id === 'mac-out') mac = clamp01(mag.k);
  if (mag?.id === 'phone-in') phone = clamp01(mag.k);
  return { mac, phone };
}

function camAt(p: number, cfg: StageConfig, outPos: THREE.Vector3, outTarget: THREE.Vector3) {
  const cams = cfg.cams;
  let i = 0;
  while (i < cams.length - 2 && cams[i + 1].p <= p) i++;
  const a = cams[i];
  const b = cams[i + 1];
  const s = smooth(clamp01((p - a.p) / (b.p - a.p)));
  outPos.lerpVectors(a.pos, b.pos, s);
  outTarget.lerpVectors(a.target, b.target, s);
}

export function evaluate(p: number, cfg: StageConfig, macStage: THREE.Matrix4, phoneStage: THREE.Matrix4, f: Frame, mag?: MagnetPose): Frame {
  p = clamp01(p);

  // ---- MacBook entry / exit (from the side and the depth; backs away as soon as the Limpet lets go)
  f.macVisible = p > R.macEnter[0] - 0.02 && p < R.macExit[1] + 0.02;
  const macIn = easeOut(span(p, R.macEnter));
  const macOut = easeInOut(span(p, R.macExit));
  // slides in from outside the right edge of the frame (slightly behind the stage); leaves left and into the depth
  f.macOffset.set((1 - macIn) * 1.25 - macOut * 1.1, (1 - macIn) * -0.08 - macOut * 0.04, (1 - macIn) * -0.3 - macOut * 0.75);

  // ---- iPhone entry / recede
  f.phoneVisible = p > R.phoneEnter[0] - 0.02 && p < R.phoneOut[1] + 0.005;
  const phIn = easeOut(span(p, R.phoneEnter));
  const phOut = easeInOut(span(p, R.phoneOut));
  // slides in from outside the right edge of the frame, slightly behind the stage, so it passes behind the Limpet
  f.phoneOffset.set((1 - phIn) * 1.0, (1 - phIn) * -0.1 - phOut * 0.06, (1 - phIn) * -0.45 - phOut * 0.3);
  f.phoneOpacity = 1 - phOut;

  // ---- Limpet
  f.rigT = 0;
  f.limpetPowered = 0;
  let cableFollows = false; // whether the cable connector follows the Limpet (plugged) or waits in the open pose
  if (mag?.id === 'mac-in') {
    // magnet pull onto the MacBook: the tray end finishes tipping onto the plate, then the other end is pulled down
    const k = clamp01(mag.k);
    if (k < KT) { const s = k / KT; macPose(-SNAP, HOVER + (PERCH - HOVER) * s, TILT * s, macStage, cfg, f.limpetPos, f.limpetQuat); }
    else { const s = (k - KT) / (1 - KT); macPose(-SNAP * (1 - s), PERCH * (1 - s), TILT * (1 - s), macStage, cfg, f.limpetPos, f.limpetQuat); }
    f.limpetPowered = mag.contact ? 1 : 0;
  } else if (mag?.id === 'mac-out') {
    const g = 1 - clamp01(mag.k);
    macPose(-SNAP * g, PERCH * g, TILT * g, macStage, cfg, f.limpetPos, f.limpetQuat);
    f.limpetPowered = mag.contact ? 1 : 0;
  } else if (mag?.id === 'phone-in') {
    // magnet pull onto MagSafe: the Limpet swings up onto the back, faster and faster
    f.rigT = clamp01(mag.k);
    phonePose(f.rigT, 0, phoneStage, f.limpetPos, f.limpetQuat, f);
    f.limpetPowered = 1;
    cableFollows = true;
  } else if (p < R.limpetToMac[0]) {
    heroPose(p, cfg, f.limpetPos, f.limpetQuat);
  } else if (p < R.limpetToMac[1]) {
    const s = easeInOut(span(p, R.limpetToMac));
    heroPose(R.limpetToMac[0], cfg, vA, qT);
    macPose(-SNAP, HOVER, 0, macStage, cfg, vB, qB);
    f.limpetPos.lerpVectors(vA, vB, s);
    f.limpetPos.y += Math.sin(s * Math.PI) * 0.03;
    f.limpetQuat.slerpQuaternions(qT, qB, s);
  } else if (p < R.tiltDown[1]) {
    // tray end comes down onto the lid (lift 0 at the pivot), the other end stays up
    const s = easeInOut(span(p, R.tiltDown));
    macPose(-SNAP, HOVER + (PERCH - HOVER) * s, TILT * s, macStage, cfg, f.limpetPos, f.limpetQuat);
  } else if (p < R.settle[1]) {
    // other end comes down while the whole Limpet snaps right onto the plug (normally the magnet does this on a timer)
    const s = cling(span(p, R.settle));
    macPose(-SNAP * (1 - s), PERCH * (1 - s), TILT * (1 - s), macStage, cfg, f.limpetPos, f.limpetQuat);
    f.limpetPowered = smooth(span(s, [0.9, 1]));
  } else if (p < R.unsettle[0]) {
    macPose(0, 0, 0, macStage, cfg, f.limpetPos, f.limpetQuat);
    f.limpetPowered = 1;
  } else if (p < R.unsettle[1]) {
    // undocking follows the scroll: the shell clings at first, then breaks free
    const s = release(span(p, R.unsettle));
    macPose(-SNAP * s, PERCH * s, TILT * s, macStage, cfg, f.limpetPos, f.limpetQuat);
    f.limpetPowered = 1 - smooth(span(s, [0.02, 0.1]));
  } else if (p < R.limpetToPhone[0]) {
    const s = easeOut(span(p, R.lift));
    macPose(-SNAP, PERCH + (LIFT - PERCH) * s, TILT * (1 - s), macStage, cfg, f.limpetPos, f.limpetQuat);
    const orient = easeInOut(span(p, R.orientToPhone));
    if (orient > 0) { phonePose(0, PLUG, phoneStage, vB, qB, f); f.limpetQuat.slerp(qB, orient); }
  } else if (p < R.limpetToPhone[1]) {
    // quadratic curve: dock → (control point in front of the connector, on its axis) → seated on the connector,
    // so the Limpet arrives along the plug's axis in one smooth move
    const s = easeInOut(span(p, R.limpetToPhone));
    const orient = easeInOut(span(p, R.orientToPhone));
    macPose(-SNAP, LIFT, 0, macStage, cfg, vA, qT);
    phonePose(0, PLUG, phoneStage, vC, qC, f);
    phonePose(0, 0, phoneStage, vB, qB, f);
    const a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, c = s * s;
    f.limpetPos.set(a * vA.x + b * vC.x + c * vB.x, a * vA.y + b * vC.y + c * vB.y, a * vA.z + b * vC.z + c * vB.z);
    f.limpetQuat.slerpQuaternions(qT, qB, orient);
    f.limpetPowered = smooth(span(p, [R.limpetToPhone[1] - 0.012, R.limpetToPhone[1]]));
    cableFollows = s >= 1;
  } else if (p < R.final[0]) {
    f.rigT = flipT(p);
    phonePose(f.rigT, 0, phoneStage, f.limpetPos, f.limpetQuat, f);
    f.limpetPowered = 1;
    cableFollows = true;
  } else {
    const s = easeInOut(span(p, R.final));
    f.rigT = 1;
    phonePose(1, 0, phoneStage, vA, qT, f); // cable stays seated on the (receding) phone
    finalPose(cfg, vB, qB);
    f.limpetPos.lerpVectors(vA, vB, s);
    f.limpetQuat.slerpQuaternions(qT, qB, s);
    f.limpetPowered = 1 - s;
    cableFollows = true;
  }

  if (!cableFollows) {
    // the cable hangs straight down from the port at first, then swings into the waiting pose
    // (plug horizontal under the phone) while the Limpet turns; it stays there until the Limpet is pushed on
    rigPose(0, vP, qP);
    vB.copy(Z).applyQuaternion(qP);                                   // waiting: facing
    vA.copy(Y).applyQuaternion(qP);                                   // waiting: up
    vS.copy(LIMPET_CONNECTOR_LOCAL).applyQuaternion(qP).add(vP);     // waiting: position
    const swing = easeInOut(span(p, R.cableSwing));
    f.connectorPos.set(PHONE_PORT.x, PHONE_PORT.y + 0.0037, PHONE_PORT.z + 0.055).lerp(vS, swing);
    f.connectorDir.set(0, 0, -1).lerp(vB, swing).normalize();
    f.connectorUp.set(0, 1, 0).lerp(vA, swing);
    f.connectorUp.addScaledVector(f.connectorDir, -f.connectorUp.dot(f.connectorDir)).normalize();
  }

  camAt(p, cfg, f.camPos, f.camTarget);
  return f;
}
