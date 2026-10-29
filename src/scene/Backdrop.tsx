/**
 * Perf step 5 — the stage's background gradient drawn inside WebGL.
 *
 * With an opaque canvas (alpha: false) the browser no longer has to blend the full-screen canvas over the
 * page every frame. The CSS gradient of `.stage` (radial 120% × 90% at 50% 40%, #fff → #f7f7f9 at 55 % →
 * #eeeef1) is reproduced here as one full-screen triangle: no texture, no tone mapping, written in sRGB.
 */
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const VERT = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;
const FRAG = /* glsl */ `
  precision highp float;
  uniform vec2 uRes;
  void main() {
    vec2 p = gl_FragCoord.xy / uRes;           // 0..1, y up
    vec2 c = vec2(0.5, 0.6);                   // CSS "at 50% 40%" (from the top) → 60 % from the bottom
    vec2 r = vec2(1.2, 0.9);                   // CSS "120% 90%": ellipse radii relative to width / height
    float d = length((p - c) / r);
    vec3 a = vec3(1.0);
    vec3 b = vec3(247.0, 247.0, 249.0) / 255.0;
    vec3 e = vec3(238.0, 238.0, 241.0) / 255.0;
    vec3 col = d < 0.55 ? mix(a, b, d / 0.55) : mix(b, e, clamp((d - 0.55) / 0.45, 0.0, 1.0));
    // a hair of dither so the long gradient does not band on 8-bit displays
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    gl_FragColor = vec4(col + (n - 0.5) / 255.0, 1.0);
  }
`;

export function Backdrop() {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    return g;
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: { uRes: { value: new THREE.Vector2(1, 1) } },
    depthTest: false, depthWrite: false, fog: false, toneMapped: false,
  }), []);
  const size = useMemo(() => new THREE.Vector2(), []);
  useFrame(({ gl }) => { gl.getDrawingBufferSize(size); material.uniforms.uRes.value.copy(size); });
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-1000} />;
}
