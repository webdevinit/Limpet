import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder': await draco3d.createDecoderModule()});
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); console.log('###', f);
  for (const m of doc.getRoot().listMaterials()) console.log('MAT', JSON.stringify(m.getName()), 'base', m.getBaseColorFactor().map(v=>+v.toFixed(2)), 'metal', m.getMetallicFactor(), 'rough', m.getRoughnessFactor(), 'tex', !!m.getBaseColorTexture(), 'emissive', m.getEmissiveFactor());
  for (const n of doc.getRoot().listNodes()) { const me=n.getMesh(); if(!me) continue; const p=me.listPrimitives()[0]; console.log('MESH', n.getName(), 'uv', !!p.getAttribute('TEXCOORD_0'), 'mat', p.getMaterial()?.getName()); }
}
