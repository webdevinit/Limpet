import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder': await draco3d.createDecoderModule()});
const doc = await io.read(process.argv[2]);
for (const a of doc.getRoot().listAnimations()) for (const ch of a.listChannels()) {
  const s = ch.getSampler(); const inp = s.getInput(); const out = s.getOutput(); const n = inp.getCount();
  console.log('ANIM', ch.getTargetNode().getName(), ch.getTargetPath(), 'keys', n, 'el', out.getElementSize());
  if (ch.getTargetPath()==='rotation') for (let i=0;i<n;i+=Math.max(1,Math.floor(n/24))) { const q=out.getElement(i,[]); 
    // lid angle: q = q90 * qz(delta): delta = 2*atan2(qx*?,...) -> compute from formula q = s*(sin, cos, sin, cos) with s=0.7071 => sin(d/2)=q[0]/0.7071
    const d = 2*Math.asin(Math.max(-1,Math.min(1,q[0]/0.70710678))); console.log('  t', inp.getElement(i,[])[0].toFixed(2), 'q', q.map(v=>+v.toFixed(3)), 'lidDeg≈', (90 - d*180/Math.PI).toFixed(1)); }
  if (ch.getTargetPath()==='weights') { const m = out.getElementSize(); for (let i=0;i<n;i+=Math.max(1,Math.floor(n/12))) { const w=out.getElement(i,[]); let best=-1,bw=0; for(let j=0;j<w.length;j++) if(w[j]>bw){bw=w[j];best=j;} console.log('  t', inp.getElement(i,[])[0].toFixed(2), 'targets', m, 'dominant', best, bw.toFixed(2), 'nz', w.filter(x=>x>0.01).length); } }
}
for (const n of doc.getRoot().listNodes()) if (/Cable|Connector|Hinge/.test(n.getName())) { const m=n.getMesh(); console.log('NODE', n.getName(), 'parent', n.getParentNode()?.getName(), m? 'tris='+(m.listPrimitives()[0].getIndices()?.getCount()/3|0)+' morphs='+m.listPrimitives()[0].listTargets().length : ''); }
