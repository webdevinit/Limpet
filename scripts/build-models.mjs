/**
 * Builds the three web models from the handover GLBs.
 *   public/models/limpet.glb   - Limpet shell (black-underside variant), canonical frame
 *   public/models/macbook.glb  - MacBook (lid open) + laptop dock plate parented to the lid hinge
 *   public/models/iphone.glb   - iPhone 16 (ultramarine)
 * and two small rig files in src/scene/ with the docking transforms.
 *
 * Canonical Limpet frame (metres, Y up) = the frame of the owner's iPhone docking rig:
 *   X: width (+-0.03157)   Y: thickness (0 .. 0.0085, top dome at +Y)   Z: length (+-0.04797), USB tray end at +Z
 * CAD mesh space (mm): x 0..63.14, y -95.94..0, z -0.5..8
 *   canonical = R_x(-90deg) * ((x - 31.57, y + 47.97, z) / 1000)
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, draco, simplify, weld, join, resample, textureCompress, mergeDocuments, unpartition } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import { mat4, quat, vec3 } from 'gl-matrix';
import fs from 'node:fs';

const B = 'Limpet_Website_Handover_2026-10-29/02_GLB';
const OUT = 'public/models';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync('src/scene', { recursive: true });

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

const KEEP_LIMPET = [
  'SSD_Body', 'SSD_Back_Plate', 'SSD_Underside_Backing', 'SSD_Power_Light', 'SSD_USB_Plate',
  'SSD_Laptap_Plate_Magsafe_Plastic_Ring_Cover_1', 'SSD_Laptap_Plate_Magnet_Adhesive_Backing_Top_1',
];
const DOCK_PARTS = [
  'SSD_Laptop_plate_001', 'SSD_USB_Roof_001', 'SSD_USB_Port', 'SSD_USB_Port_Clamp_001', 'SSD_Cable_Plate_001',
  'SSD_Cable_Pusher_Left_001', 'SSD_Cable_Pusher_Right_001', 'SSD_Limpet_Technical_V3_v36_011', 'SSD_Sticker_Adhesive_To_Laptop_001',
];

// CAD(mm) -> canonical(m)
const cadToCanon = mat4.create();
{
  const rx = mat4.fromXRotation(mat4.create(), -Math.PI / 2);
  const tr = mat4.fromTranslation(mat4.create(), [-31.57, 47.97, 0]);
  const sc = mat4.fromScaling(mat4.create(), [0.001, 0.001, 0.001]);
  mat4.multiply(cadToCanon, sc, tr);
  mat4.multiply(cadToCanon, rx, cadToCanon);
}

function nodeWorld(node) {
  const m = mat4.clone(node.getMatrix());
  let p = node.getParentNode();
  while (p) { mat4.multiply(m, p.getMatrix(), m); p = p.getParentNode(); }
  return m;
}
function setNodeMatrix(node, m) {
  const t = mat4.getTranslation(vec3.create(), m);
  const r = mat4.getRotation(quat.create(), m); quat.normalize(r, r);
  const s = mat4.getScaling(vec3.create(), m);
  node.setTranslation([...t]).setRotation([...r]).setScale([...s]);
}
const fmt = (m) => Array.from(m).map((v) => +v.toFixed(6));

async function finish(doc, file, opts = {}) {
  await doc.transform(
    unpartition(),
    prune({ keepAttributes: true }),
    dedup(),
    weld(),
    // perf step 3: merge sibling meshes that share a material into one draw call. join() works level by
    // level, so parts under a different parent (the MacBook's lid under MacBook_Display_Hinge) stay separate
    // and the hinge can still be rotated at runtime.
    join({ keepNamed: false }),
    prune({ keepAttributes: true }),
    ...(opts.simplify ? [simplify({ simplifier: MeshoptSimplifier, ratio: opts.simplify, error: 0.0005 })] : []),
    resample(),
    textureCompress({ targetFormat: 'webp', resize: [1024, 1024] }),
    draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
  );
  await io.write(file, doc);
  const tris = doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  console.log(`${file}: ${(fs.statSync(file).size / 1024).toFixed(0)} KB, ${tris | 0} tris, ${doc.getRoot().listMeshes().length} meshes`);
}

// ---------------------------------------------------------------- Limpet
{
  const doc = await io.read(`${B}/Devices/ssd.glb`);
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const assembly = root.listNodes().find((n) => n.getName() === 'SSD_Assembly');
  const limpet = doc.createNode('Limpet');
  for (const child of [...assembly.listChildren()]) {
    if (!KEEP_LIMPET.includes(child.getName())) { child.dispose(); continue; }
    assembly.removeChild(child);
    setNodeMatrix(child, cadToCanon);
    limpet.addChild(child);
  }
  for (const c of [...scene.listChildren()]) scene.removeChild(c);
  scene.addChild(limpet);
  for (const m of root.listMaterials()) {
    if (/Sandblasted/.test(m.getName())) m.setName('Limpet aluminium');
    if (/Leather/.test(m.getName())) m.setName('Limpet underside');
  }
  // Planar UVs (the handover meshes carry none): u across the width, v along the length, in CAD mm space.
  const buffer = root.listBuffers()[0];
  for (const child of limpet.listChildren()) {
    const mesh = child.getMesh(); if (!mesh) continue;
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'); if (!pos) continue;
      const n = pos.getCount(); const uv = new Float32Array(n * 2); const v = [];
      for (let i = 0; i < n; i++) { pos.getElement(i, v); uv[i * 2] = v[0] / 63.14; uv[i * 2 + 1] = (v[1] + 95.94) / 95.94; }
      prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(buffer));
    }
  }
  const body = root.listNodes().find((n) => n.getName() === 'SSD_Body');
  const pos = body.getMesh().listPrimitives()[0].getAttribute('POSITION');
  const mn = vec3.transformMat4(vec3.create(), pos.getMin([]), cadToCanon);
  const mx = vec3.transformMat4(vec3.create(), pos.getMax([]), cadToCanon);
  console.log('limpet canonical corner bounds:', fmt(mn), fmt(mx));
  await finish(doc, `${OUT}/limpet.glb`);
}

// ---------------------------------------------------------------- MacBook + dock plate + fabric cable
const LID_DEG = 82; // stage lid angle; the fabric cable is baked for this angle
const CABLE_BASE_PARTS = ['Cable_Flexible_Fabric', 'Cable_Underside_Fabric', 'Connector_Outer_Cap', 'Connector_Strain_Relief', 'SSD_Connector', 'Cable_Prototype_connector_solder_pad', 'Cable_Prototype_connector_solder_pad_001'];
const CABLE_DOCK_PARTS = ['Cable_Internal_Fabric'];
let macDock;
{
  const doc = await io.read(`${B}/Devices/macbook.glb`);
  const root = doc.getRoot();
  const hinge = root.listNodes().find((n) => n.getName() === 'MacBook_Display_Hinge');
  const macAssembly = root.listNodes().find((n) => n.getName() === 'MacBook_Assembly');

  // Source: the open/close product sequence (dock plate, cable channel, fabric cable with 250 morph poses).
  const src = await io.read(`${B}/Sequences/product_sequence.glb`);
  const sroot = src.getRoot();
  const srcAssembly = sroot.listNodes().find((n) => n.getName() === 'SSD_Assembly');
  const A = mat4.clone(srcAssembly.getMatrix());
  const C = mat4.clone(srcAssembly.listChildren().find((c) => c.getName() === 'SSD_Body').getMatrix());
  const meshToHinge = mat4.multiply(mat4.create(), A, C); // CAD mm -> hinge-local metres
  const canonToHinge = mat4.multiply(mat4.create(), meshToHinge, mat4.invert(mat4.create(), cadToCanon));

  // --- bake the fabric cable at the key whose lid angle is closest to LID_DEG
  const anim = sroot.listAnimations()[0];
  const rotCh = anim.listChannels().find((c) => c.getTargetNode().getName() === 'MacBook_Display_Hinge' && c.getTargetPath() === 'rotation');
  const wCh = anim.listChannels().find((c) => c.getTargetPath() === 'weights');
  const rIn = rotCh.getSampler().getInput(), rOut = rotCh.getSampler().getOutput();
  let best = 0, bestErr = 1e9;
  for (let i = 0; i < rIn.getCount(); i++) {
    const q = rOut.getElement(i, []);
    const lid = 90 - (2 * Math.asin(Math.max(-1, Math.min(1, q[0] / 0.70710678)))) * 180 / Math.PI;
    if (Math.abs(lid - LID_DEG) < bestErr) { bestErr = Math.abs(lid - LID_DEG); best = i; }
  }
  const bestT = rIn.getElement(best, [])[0];
  const wIn = wCh.getSampler().getInput(), wOut = wCh.getSampler().getOutput();
  let wi = 0; for (let i = 0; i < wIn.getCount(); i++) if (Math.abs(wIn.getElement(i, [])[0] - bestT) < 1e-4) wi = i;
  const T = wOut.getArray().length / wIn.getCount(); // flat layout: keys x targets
  const weights = Array.from(wOut.getArray().subarray(wi * T, (wi + 1) * T));
  const cableNode = sroot.listNodes().find((n) => n.getName() === 'Cable_Flexible_Fabric');
  for (const prim of cableNode.getMesh().listPrimitives()) {
    const targets = prim.listTargets();
    for (const sem of ['POSITION', 'NORMAL']) {
      const base = prim.getAttribute(sem);
      if (!base) continue;
      const arr = Float32Array.from(base.getArray());
      targets.forEach((t, ti) => {
        const w = weights[ti]; if (!w || Math.abs(w) < 1e-4) return;
        const d = t.getAttribute(sem); if (!d) return;
        const da = d.getArray();
        for (let k = 0; k < arr.length; k++) arr[k] += w * da[k];
      });
      base.setArray(arr);
    }
    for (const t of targets) { prim.removeTarget(t); t.dispose(); }
  }
  cableNode.getMesh().setWeights([]);
  console.log(`cable baked at t=${bestT.toFixed(2)}s (lid error ${bestErr.toFixed(1)}°), active targets=${weights.filter((w) => Math.abs(w) > 1e-4).length}`);

  // --- keep only the parts we want from the source, then merge
  const keep = new Set([...DOCK_PARTS, ...CABLE_BASE_PARTS, ...CABLE_DOCK_PARTS]);
  const srcLocal = new Map(); // name -> local matrix (relative to its parent in the source)
  for (const n of sroot.listNodes()) {
    if (n.getMesh()) { if (!keep.has(n.getName())) n.dispose(); else srcLocal.set(n.getName(), mat4.clone(n.getMatrix())); }
  }
  for (const a of sroot.listAnimations()) a.dispose();
  await src.transform(prune());
  mergeDocuments(doc, src);
  const dockGroup = doc.createNode('LaptopDock');
  const cableGroup = doc.createNode('LaptopCable');
  for (const n of root.listNodes()) {
    const name = n.getName();
    if (!keep.has(name) || !n.getMesh() || !srcLocal.has(name)) continue;
    n.getParentNode()?.removeChild(n);
    if (DOCK_PARTS.includes(name) || CABLE_DOCK_PARTS.includes(name)) {
      setNodeMatrix(n, mat4.multiply(mat4.create(), A, srcLocal.get(name))); // hinge-local
      dockGroup.addChild(n);
    } else {
      setNodeMatrix(n, srcLocal.get(name)); // MacBook_Assembly-local
      cableGroup.addChild(n);
    }
  }
  for (const s of root.listScenes().slice(1)) s.dispose();
  hinge.addChild(dockGroup);
  macAssembly.addChild(cableGroup);
  macDock = {
    note: 'Column-major 4x4: canonical Limpet frame -> MacBook_Display_Hinge local frame. hingeRotation90 = hinge quaternion with the lid upright; the cable is baked for lidDeg.',
    matrix: fmt(canonToHinge),
    hingeLocalTranslation: fmt(hinge.getTranslation()),
    hingeRotation90: fmt(hinge.getRotation()),
    lidDeg: LID_DEG,
  };
  for (const m of root.listMaterials()) if (m.getName() === 'Orange grain plastic') m.setName('Dock ring');
  await finish(doc, `${OUT}/macbook.glb`, { simplify: 0.35 });
}

// ---------------------------------------------------------------- iPhone
{
  const doc = await io.read(`${B}/Devices/iphone.glb`);
  await finish(doc, `${OUT}/iphone.glb`);
}

// ---------------------------------------------------------------- iPhone docking track (from the owner's rig)
{
  const doc = await io.read(`${B}/Sequences/iphone16_attach_detach.glb`);
  const anim = doc.getRoot().listAnimations()[0];
  const tr = anim.listChannels().find((c) => c.getTargetPath() === 'translation').getSampler();
  const ro = anim.listChannels().find((c) => c.getTargetPath() === 'rotation').getSampler();
  const times = tr.getInput();
  const n = times.getCount();
  const keys = [];
  for (let i = 0; i < n; i++) {
    const t = times.getElement(i, [])[0];
    if (t < 0.58 || t > 4.42) continue;
    keys.push({
      t: +((t - 0.6) / 3.8).toFixed(4),
      p: tr.getOutput().getElement(i, []).map((v) => +v.toFixed(5)),
      q: ro.getOutput().getElement(i, []).map((v) => +v.toFixed(5)),
    });
  }
  keys[0].t = 0;
  keys[keys.length - 1].t = 1;
  const docked = await io.read(`${B}/Assemblies/iphone16_limpet_docked.glb`);
  const nodeW = (d, name) => fmt(mat4.getTranslation(vec3.create(), nodeWorld(d.getRoot().listNodes().find((x) => x.getName() === name))));
  const rig = {
    note: 'Limpet pose relative to the iPhone root (phone lying screen-down, back at +Y, USB-C port at +Z). Extracted from iphone16_attach_detach.glb, t=0.6..4.4s (attach).',
    phonePort: nodeW(docked, 'Connector_A_iPhone'),
    limpetConnectorLocal: [0, 0.0032, 0.0239],
    dockedPose: { p: [0, 0.0088, 0.0165], q: [0, 0, 0, 1] },
    openPose: { p: [0, 0.0093, 0.154], q: [-1, 0, 0, 0] },
    keys,
  };
  fs.writeFileSync('src/scene/rig-iphone.json', JSON.stringify(rig));
  fs.writeFileSync('src/scene/rig-macbook.json', JSON.stringify(macDock));
  console.log('iPhone attach keys:', keys.length, 'phonePort', rig.phonePort);
  console.log('MacBook dock canonical->hinge:', macDock.matrix);
}
