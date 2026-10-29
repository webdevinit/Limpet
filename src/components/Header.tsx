import { useRef, useState } from 'react';
import { site, pricing, firstBatch } from '../content';
import { BagIcon, LimpetMark, PatPendingFace, WINK_MS } from './ui';

/** Same layout as patpending.com: Limpet brand left, Pat Pending face centred, bag + Pre-order right. */
export function Header() {
  // the Pat Pending face winks when the pointer comes onto it (or it gets keyboard focus); not again mid-wink
  const [wink, setWink] = useState(0);
  const lastWink = useRef(0);
  const onWink = () => {
    const now = performance.now();
    if (now - lastWink.current < WINK_MS) return;
    lastWink.current = now;
    setWink((w) => w + 1);
  };
  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Main navigation">
        <a className="brand-home" href="/" aria-label="Limpet home">
          <LimpetMark />
          {site.brand}
        </a>
        <a className="pat-pending-home" href="/" aria-label="Pat Pending home" onMouseEnter={onWink} onFocus={onWink}>
          <PatPendingFace className="pat-pending-mark" wink={wink} />
        </a>
        <div className="site-links">
          <a className="bag" href={site.links.preorder} target="_blank" rel="noopener" aria-label="Configure your Limpet">
            <BagIcon />
          </a>
          <a className="btn small" href={site.links.preorder} target="_blank" rel="noopener">{pricing.orderStatus}</a>
        </div>
      </nav>
      <a className="founders-banner" href="#pricing">{firstBatch.banner}</a>
    </header>
  );
}
