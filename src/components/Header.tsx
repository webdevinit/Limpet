import { site, pricing } from '../content';
import { BagIcon, LimpetMark, PatPendingFace } from './ui';

/** Same layout as patpending.com: Limpet brand left, Pat Pending face centred, bag + Pre-order right. */
export function Header() {
  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Main navigation">
        <a className="brand-home" href="/" aria-label="Limpet home">
          <LimpetMark />
          {site.brand}
        </a>
        <a className="pat-pending-home" href="/" aria-label="Pat Pending home">
          <PatPendingFace className="pat-pending-mark" />
        </a>
        <div className="site-links">
          <a className="bag" href={site.links.preorder} target="_blank" rel="noopener" aria-label="Configure your Limpet">
            <BagIcon />
          </a>
          <a className="btn small" href={site.links.preorder} target="_blank" rel="noopener">{pricing.orderStatus}</a>
        </div>
      </nav>
    </header>
  );
}
