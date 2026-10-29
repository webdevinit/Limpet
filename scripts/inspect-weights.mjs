import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder': await draco3d.createDecoderModule()});
const doc = await io.read(process.argv[2]);
const a = doc.getRoot().listAnimations()[0];
const ch = a.listChannels().find(c => c.getTargetPath()==='weights');
const s = ch.getSampler(); const inp=s.getInput(), out=s.getOutput();
const n = inp.getCount(), m = out.getElementSize(); console.log('keys', n, 'elSize', m, 'outCount', out.getCount(), 'interp', s.getInterpolation(), 'targets', ch.getTargetNode().getMesh().listPrimitives()[0].listTargets().length);
const raw = out.getArray(); console.log('raw length', raw.length, 'max', Math.max(...raw));
// weights are flat: count*targets
const T = raw.length / n; console.log('targets per key', T);
for (let i=0;i<n;i+=Math.max(1,Math.floor(n/10))) { const w = raw.subarray(i*T,(i+1)*T); let best=-1,bw=0; for(let j=0;j<T;j++) if(w[j]>bw){bw=w[j];best=j;} console.log(' key',i,'t',inp.getElement(i,[])[0].toFixed(2),'dominant',best,bw.toFixed(3),'nz',Array.from(w).filter(x=>x>0.01).length); }
