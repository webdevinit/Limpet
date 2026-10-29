import { useEffect, useState } from 'react';

export type Capabilities = {
  webgl: boolean;
  reducedMotion: boolean;
  lowPower: boolean;
  mobile: boolean;
  ready: boolean;
};

function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return !!gl;
  } catch {
    return false;
  }
}

function detectLowPower(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = nav.deviceMemory ?? 8;
  const saveData = nav.connection?.saveData === true;
  const slowNet = /2g|3g/.test(nav.connection?.effectiveType ?? '');
  return cores <= 4 || mem <= 4 || saveData || slowNet;
}

/** Feature detection used to pick the full 3D stage, a lighter stage, or the static fallback. */
export function useCapabilities(): Capabilities {
  const [caps, setCaps] = useState<Capabilities>({ webgl: true, reducedMotion: false, lowPower: false, mobile: false, ready: false });
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = window.matchMedia('(max-width: 860px)');
    const update = () =>
      setCaps({ webgl: detectWebGL(), reducedMotion: mq.matches, lowPower: detectLowPower(), mobile: mobile.matches, ready: true });
    update();
    mq.addEventListener('change', update);
    mobile.addEventListener('change', update);
    return () => { mq.removeEventListener('change', update); mobile.removeEventListener('change', update); };
  }, []);
  return caps;
}
