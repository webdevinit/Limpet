import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { mat4, vec3 } from 'gl-matrix';
import path from 'node:path';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const files = process.argv.slice(2);
for (const f of files) {
  const doc = await io.read(f);
  const root = doc.getRoot();
  console.log('\n######', path.basename(f));
  console.log('materials:', root.listMaterials().map(m => m.getName()).join(', '));
  console.log('textures:', root.listTextures().map(t => `${t.getName()||'?'}(${t.getSize()?.join('x')},${(t.getImage()?.byteLength/1024|0)}KB)`).join(', '));
  console.log('animations:', root.listAnimations().map(a => `${a.getName()} ch=${a.listChannels().length} targets=${[...new Set(a.listChannels().map(c=>c.getTargetNode()?.getName()+':'+c.getTargetPath()))].join('|')}`).join('; '));
  const scene = root.listScenes()[0];
  const walk = (n, depth, parentM) => {
    const local = n.getMatrix();
    const world = mat4.multiply(mat4.create(), parentM, local);
    const mesh = n.getMesh();
    let info = '';
    if (mesh) {
      const prim = mesh.listPrimitives()[0];
      const pos = prim?.getAttribute('POSITION');
      const tris = mesh.listPrimitives().reduce((s,p)=> s + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount())/3, 0);
      let bb = '';
      if (pos) {
        const mn = pos.getMin([]), mx = pos.getMax([]);
        const corners=[];
        for (const x of [mn[0],mx[0]]) for (const y of [mn[1],mx[1]]) for (const z of [mn[2],mx[2]]) corners.push(vec3.transformMat4(vec3.create(), [x,y,z], world));
        const wmn=[Infinity,Infinity,Infinity], wmx=[-Infinity,-Infinity,-Infinity];
        for (const c of corners) for (let i=0;i<3;i++){wmn[i]=Math.min(wmn[i],c[i]);wmx[i]=Math.max(wmx[i],c[i]);}
        bb = ` worldBB=[${wmn.map(v=>v.toFixed(4))}]..[${wmx.map(v=>v.toFixed(4))}]`;
      }
      info = ` MESH tris=${tris|0} morphs=${prim?.listTargets().length||0} mats=${mesh.listPrimitives().map(p=>p.getMaterial()?.getName()).join('/')}${bb}`;
    }
    const t = n.getTranslation(), r = n.getRotation(), s = n.getScale();
    const wp = vec3.transformMat4(vec3.create(), [0,0,0], world);
    console.log(`${'  '.repeat(depth)}- ${n.getName()} t=[${t.map(v=>v.toFixed(4))}] r=[${r.map(v=>v.toFixed(3))}] s=[${s.map(v=>v.toFixed(3))}] worldPos=[${wp.map(v=>v.toFixed(4))}]${info}`);
    for (const c of n.listChildren()) walk(c, depth+1, world);
  };
  for (const n of scene.listChildren()) walk(n, 0, mat4.create());
}
