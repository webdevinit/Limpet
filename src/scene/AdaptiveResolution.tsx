/**
 * Perf step 1 — adaptive resolution with a pixel budget.
 *
 * At rest the canvas renders at the device's pixel ratio (capped, and never above REST_BUDGET pixels,
 * which matters on 4K/Retina). While the scene is moving (scroll, intro) the frame time is watched: if
 * frames get slow the backing store is stepped down, never below MOTION_FLOOR pixels; if they are fast
 * again it steps back up. 220 ms after the motion stops the full resolution is restored, so the still
 * image is always crisp. Also feeds the optional on-screen stats readout (`?stats=1`).
 */
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

/** most pixels the canvas renders at rest (≈ 2560 × 1750) */
const REST_BUDGET = 4.5e6;
/** fewest pixels while moving (≈ 1400 × 790) */
const MOTION_FLOOR = 1.1e6;
/** frame time above which the resolution steps down, below which it steps up (ms) */
const SLOW_MS = 17.5;
const FAST_MS = 11;
const STEP_DOWN = 0.85;
const STEP_UP = 1 / 0.9;

export type AdaptiveProps = {
  progress: React.MutableRefObject<number>;
  intro: React.MutableRefObject<number>;
  introMs: number;
  lowPower: boolean;
  stats?: React.MutableRefObject<HTMLPreElement | null>;
};

export function AdaptiveResolution({ progress, intro, introMs, lowPower, stats }: AdaptiveProps) {
  const { gl, setDpr, size } = useThree();
  const s = useRef({ applied: 0, target: 0, ema: 16, lastP: -1, lastChange: 0, quietSince: 0, lastStats: 0, frames: 0 });

  useFrame((_, dt) => {
    const st = s.current;
    const w = size.width, h = size.height;
    if (!w || !h) return;
    const now = performance.now();
    const deviceDpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2);
    const restDpr = Math.min(deviceDpr, Math.sqrt(REST_BUDGET / (w * h)));
    const floorDpr = Math.min(restDpr, Math.max(0.7, Math.sqrt(MOTION_FLOOR / (w * h))));
    if (st.target === 0) st.target = restDpr;

    const p = progress.current;
    const introActive = intro.current > 0 && now - intro.current < introMs + 200;
    const moving = Math.abs(p - st.lastP) > 1e-5 || introActive;
    st.lastP = p;

    const ms = Math.min(dt * 1000, 100);
    st.ema += (ms - st.ema) * 0.15;
    st.frames++;

    if (moving) {
      st.quietSince = now;
      if (st.ema > SLOW_MS && now - st.lastChange > 250 && st.target > floorDpr + 0.01) {
        st.target = Math.max(floorDpr, st.target * STEP_DOWN); st.lastChange = now; st.ema = 16;
      } else if (st.ema < FAST_MS && now - st.lastChange > 700 && st.target < restDpr - 0.01) {
        st.target = Math.min(restDpr, st.target * STEP_UP); st.lastChange = now; st.ema = 16;
      }
    } else if (now - st.quietSince > 220 && Math.abs(st.target - restDpr) > 0.01) {
      st.target = restDpr; st.lastChange = now;
    }
    if (Math.abs(st.target - st.applied) > 0.02) { st.applied = st.target; setDpr(st.target); }

    const el = stats?.current;
    if (el && now - st.lastStats > 250) {
      st.lastStats = now;
      const r = gl.info.render;
      const px = Math.round(w * st.applied) * Math.round(h * st.applied);
      el.textContent =
        `${(1000 / st.ema).toFixed(0)} fps · ${st.ema.toFixed(1)} ms\n` +
        `dpr ${st.applied.toFixed(2)} (rest ${restDpr.toFixed(2)}) · ${(px / 1e6).toFixed(2)} MP\n` +
        `${r.calls} draw calls · ${(r.triangles / 1000).toFixed(0)}k tris · ${moving ? 'moving' : 'idle'}`;
    }
  });
  return null;
}
