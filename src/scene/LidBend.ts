/**
 * Bends the MacBook's flexible USB-C cable with the lid.
 *
 * The cable mesh belongs to the base and is modelled for the open lid (`lidDeg` in the rig). When the lid opens or
 * closes, the part of the cable that lies on the lid has to turn with it while the part on the base stays put. Each
 * vertex gets a weight from its angle around the hinge axis (base side 0 … lid side 1, a soft blend around the hinge)
 * and is turned by that share of the lid's rotation. Normals turn the same way.
 *
 * Runs on the CPU only on frames where the lid angle changed (entry and exit of the MacBook); at rest it costs nothing.
 */
import * as THREE from 'three';
import { hingeQuaternion } from './choreography';

const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class CableBend {
  private pos0: Float32Array;
  private nrm0: Float32Array | null;
  private w: Float32Array;
  private pivot = new THREE.Vector3();
  private axis = new THREE.Vector3();
  private last: number;
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();

  /**
   * cable: the flexible cable (base side); hinge: the lid's hinge node at the baked angle;
   * lid / base: a mesh on each side (for their directions from the hinge); bakedDeg: the angle the cable was modelled at
   */
  constructor(private cable: THREE.Mesh, hinge: THREE.Object3D, lid: THREE.Object3D, base: THREE.Object3D, private bakedDeg: number) {
    this.last = bakedDeg;
    const root = hinge.parent ?? hinge;
    root.updateMatrixWorld(true);
    cable.updateMatrixWorld(true);
    const toLocal = cable.matrixWorld.clone().invert();

    // hinge axis: the lid angle turns the hinge about (rest rotation · Z), in the hinge's parent frame
    const q90 = hingeQuaternion(90);
    this.axis.set(0, 0, 1).applyQuaternion(q90).transformDirection(hinge.parent!.matrixWorld).transformDirection(toLocal).normalize();
    hinge.getWorldPosition(this.pivot).applyMatrix4(toLocal);

    // directions from the hinge to the lid and to the base, flattened onto the plane around the axis
    const dirTo = (o: THREE.Object3D) => {
      const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).applyMatrix4(toLocal).sub(this.pivot);
      return c.addScaledVector(this.axis, -c.dot(this.axis)).normalize();
    };
    const e1 = dirTo(base);
    const lidDir = dirTo(lid);
    const e2 = new THREE.Vector3().crossVectors(this.axis, e1).normalize();
    if (lidDir.dot(e2) < 0) e2.negate();
    const inside = Math.atan2(lidDir.dot(e2), lidDir.dot(e1)); // angle base → lid through the keyboard side (0 … π)
    // the cable runs round the outside of the hinge: measure from the base the other way round, so the branch cut
    // sits in the middle of the inside (where the cable never is)
    const lidOut = inside - Math.PI * 2;

    const pos = cable.geometry.attributes.position as THREE.BufferAttribute;
    const nrm = cable.geometry.attributes.normal as THREE.BufferAttribute | undefined;
    this.pos0 = (pos.array as Float32Array).slice();
    this.nrm0 = nrm ? (nrm.array as Float32Array).slice() : null;
    this.w = new Float32Array(pos.count);
    const x = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      x.fromArray(this.pos0, i * 3).sub(this.pivot);
      x.addScaledVector(this.axis, -x.dot(this.axis));
      let phi = Math.atan2(x.dot(e2), x.dot(e1));
      if (phi > inside / 2) phi -= Math.PI * 2;
      this.w[i] = smoothstep(0.12, 0.88, phi / lidOut);
    }
    // the bent cable leaves its modelled bounds
    cable.frustumCulled = false;
  }

  /** shapes the cable for this lid angle (degrees, same convention as the rig) */
  update(lidDeg: number) {
    if (Math.abs(lidDeg - this.last) < 1e-4) return;
    this.last = lidDeg;
    const delta = THREE.MathUtils.degToRad(this.bakedDeg - lidDeg);
    const pos = this.cable.geometry.attributes.position as THREE.BufferAttribute;
    const nrm = this.cable.geometry.attributes.normal as THREE.BufferAttribute | undefined;
    const P = pos.array as Float32Array;
    const N = nrm ? (nrm.array as Float32Array) : null;
    const { pos0, nrm0, w, pivot, axis, q, v } = this;
    for (let i = 0; i < pos.count; i++) {
      const j = i * 3;
      const a = w[i] * delta;
      if (a === 0) { P[j] = pos0[j]; P[j + 1] = pos0[j + 1]; P[j + 2] = pos0[j + 2]; if (N && nrm0) { N[j] = nrm0[j]; N[j + 1] = nrm0[j + 1]; N[j + 2] = nrm0[j + 2]; } continue; }
      q.setFromAxisAngle(axis, a);
      v.set(pos0[j] - pivot.x, pos0[j + 1] - pivot.y, pos0[j + 2] - pivot.z).applyQuaternion(q);
      P[j] = v.x + pivot.x; P[j + 1] = v.y + pivot.y; P[j + 2] = v.z + pivot.z;
      if (N && nrm0) { v.set(nrm0[j], nrm0[j + 1], nrm0[j + 2]).applyQuaternion(q); N[j] = v.x; N[j + 1] = v.y; N[j + 2] = v.z; }
    }
    pos.needsUpdate = true;
    if (nrm) nrm.needsUpdate = true;
  }
}
