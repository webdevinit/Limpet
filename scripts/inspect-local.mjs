import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder': await draco3d.createDecoderModule()});
const [file, ...names] = process.argv.slice(2);
const doc = await io.read(file);
for (const n of doc.getRoot().listNodes()) {
  if (!names.includes(n.getName())) continue;
  const mesh = n.getMesh();
  if (mesh) for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION');
    console.log(n.getName(), 'localMin', pos.getMin([]).map(v=>+v.toFixed(3)), 'localMax', pos.getMax([]).map(v=>+v.toFixed(3)), 'verts', pos.getCount());
  }
}
for (const a of doc.getRoot().listAnimations()) for (const ch of a.listChannels()) {
  const s = ch.getSampler(); const inp = s.getInput(); const out = s.getOutput();
  const n = inp.getCount(); const el = out.getElementSize();
  console.log('ANIM', ch.getTargetNode().getName(), ch.getTargetPath(), 'keys', n, 'elSize', el, 'interp', s.getInterpolation(), 'tmax', inp.getElement(n-1,[])[0].toFixed(3));
  if (ch.getTargetPath()!=='weights') {
    for (let i=0;i<n;i+= Math.max(1,Math.floor(n/16))) console.log('   t=',inp.getElement(i,[])[0].toFixed(3), out.getElement(i,[]).map(v=>+v.toFixed(4)));
  } else {
    // which target has highest weight at a few frames
    for (let i=0;i<n;i+= Math.max(1,Math.floor(n/8))) { const w=out.getElement(i,[]); let best=0; for(let j=0;j<w.length;j++) if(w[j]>w[best]) best=j; console.log('   t=',inp.getElement(i,[])[0].toFixed(3),'dominant target',best,'w',w[best].toFixed(2),'nonzero',w.filter(x=>x>0.001).length); }
  }
}
