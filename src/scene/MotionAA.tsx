/**
 * Perf step 8 — multisampling only while the picture stands still.
 *
 * The scene is rendered into an offscreen target and copied to the canvas. At rest the target has 4×
 * MSAA (the still image is as clean as before); while the sequence moves it has none, which removes
 * the 4× coverage work exactly when the adaptive resolution is already fighting for frame time.
 * The target is linear half-float; three still tone-maps into it because of the `isXRRenderTarget`
 * flag, and the copy pass applies the sRGB output transfer, so the result matches a direct render.
 */
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export type MotionRef = React.MutableRefObject<{ moving: boolean; samples: number; calls: number; triangles: number }>;

const REST_SAMPLES = 4;

function makeTarget(samples: number, type: THREE.TextureDataType) {
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    samples, type, format: THREE.RGBAFormat, colorSpace: THREE.LinearSRGBColorSpace,
    depthBuffer: true, stencilBuffer: false, generateMipmaps: false,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
  });
  // makes three apply tone mapping and the texture's colour space when rendering into it (as on the canvas)
  (rt as THREE.WebGLRenderTarget & { isXRRenderTarget: boolean }).isXRRenderTarget = true;
  return rt;
}

export function MotionAA({ motion }: { motion: MotionRef }) {
  const { gl, scene, camera } = useThree();
  const floatOk = useMemo(() => gl.capabilities.isWebGL2 && gl.extensions.has('EXT_color_buffer_float'), [gl]);
  const type = floatOk ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const targets = useMemo(() => ({ rest: makeTarget(REST_SAMPLES, type), motion: makeTarget(0, type) }), [type]);
  const blit = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const material = new THREE.MeshBasicMaterial({ toneMapped: false, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    const s = new THREE.Scene();
    s.add(mesh);
    return { scene: s, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), material };
  }, []);
  const size = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => () => { targets.rest.dispose(); targets.motion.dispose(); blit.material.dispose(); }, [targets, blit]);

  // priority 1: takes over rendering from R3F
  useFrame(() => {
    const rt = motion.current.moving ? targets.motion : targets.rest;
    motion.current.samples = rt.samples;
    gl.getDrawingBufferSize(size);
    if (rt.width !== size.x || rt.height !== size.y) rt.setSize(size.x, size.y);
    gl.setRenderTarget(rt);
    gl.render(scene, camera);
    // the scene pass's numbers for the stats readout (gl.info resets on every render call)
    motion.current.calls = gl.info.render.calls;
    motion.current.triangles = gl.info.render.triangles;
    gl.setRenderTarget(null);
    blit.material.map = rt.texture;
    gl.render(blit.scene, blit.camera);
  }, 1);
  return null;
}
