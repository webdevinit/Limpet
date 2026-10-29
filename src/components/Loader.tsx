/**
 * Full-page loading screen: the limpet-shell mark draws itself, the Pat Pending face blinks,
 * a thin orange bar fills with real asset progress. Shown for at least `MIN_MS`.
 */
import { useEffect, useState } from 'react';
import { LimpetMark, PatPendingFace } from './ui';

export const MIN_MS = 2000;

export function Loader({ progress, done, onLeaving, onHidden }: { progress: number; done: boolean; onLeaving?: () => void; onHidden: () => void }) {
  const [minElapsed, setMinElapsed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMinElapsed(true), MIN_MS); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (!(done && minElapsed)) return;
    setLeaving(true);
    onLeaving?.();
    const t = setTimeout(onHidden, 650);
    return () => clearTimeout(t);
  }, [done, minElapsed, onLeaving, onHidden]);
  useEffect(() => {
    document.documentElement.classList.add('is-loading');
    return () => document.documentElement.classList.remove('is-loading');
  }, []);

  const pct = Math.max(6, Math.round(progress));
  return (
    <div className={`loader${leaving ? ' leaving' : ''}`} role="status" aria-live="polite" aria-label="Loading Limpet">
      <div className="loader-inner">
        <div className="loader-mark">
          <LimpetMark className="loader-shell" draw />
          <PatPendingFace className="loader-face" />
        </div>
        <p className="loader-line">Holds on. <span>Like a limpet.</span></p>
        <div className="loader-bar" aria-hidden="true"><i style={{ width: `${leaving ? 100 : pct}%` }} /></div>
      </div>
    </div>
  );
}
