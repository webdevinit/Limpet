/**
 * Sticky scroll stage: native scrolling, a 100vh sticky viewport, a lazy WebGL canvas
 * and real HTML overlay copy per scene. The page-level loader covers the stage until the
 * models are decoded; then the Limpet glides in.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { activeScene, textState } from './choreography';
import { hero, scenes, pricing, site } from '../content';
import { Button, Lines } from '../components/ui';
import type { Capabilities } from '../hooks/useCapabilities';
import { emptyHeroLayout, measureHeroLayout } from './heroLayout';

const StageCanvas = lazy(() => import('./StageCanvas'));

/**
 * The sequence follows the scroll position, but never faster than this (progress per second): a hard flick
 * still plays every move instead of jumping to the end. The full sequence takes at least 1 / MAX_SPEED s.
 */
const MAX_SPEED = 0.2;
/** below the cap the sequence eases towards the scroll position at this rate (1/s), so small scrolls stay smooth */
const FOLLOW = 9;

export function Stage({ caps, onLoaded, intro, invalidate }: { caps: Capabilities; onLoaded: () => void; intro: React.MutableRefObject<number>; invalidate: React.MutableRefObject<(() => void) | null> }) {
  const trackRef = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const blocks = useRef<(HTMLDivElement | null)[]>([]);
  /** hero copy's bottom edge and the stage's offset from the page top (px); the canvas keeps the resting Limpet below the copy and inside the first screen */
  const heroLayout = useRef(emptyHeroLayout());
  // `?stats=1` shows fps, resolution and draw calls over the stage (used to compare the perf steps)
  const statsRef = useRef<HTMLPreElement | null>(null);
  const showStats = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('stats');
  const dots = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const onReady = useCallback(() => onLoaded(), [onLoaded]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: '10% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    let lastP = -1;
    let shown = -1; // progress the stage currently plays (chases the scroll position at a capped speed)
    let lastT = 0;
    const update = (now: number) => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const target = Math.min(1, Math.max(0, -rect.top / (rect.height - vh)));
      const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 1 / 60;
      lastT = now;
      // off screen (or on the first measure, e.g. a restored scroll position) there is nothing to watch: jump
      const visible = rect.bottom > 0 && rect.top < vh;
      if (shown < 0 || !visible) shown = target;
      else {
        const d = target - shown;
        const step = Math.min(Math.abs(d), Math.max(Math.abs(d) * FOLLOW, 0.002) * dt, MAX_SPEED * dt);
        shown += Math.sign(d) * step;
        if (Math.abs(target - shown) < 1e-5) shown = target;
      }
      const p = shown;
      progress.current = p;
      // the canvas renders on demand: ask for a frame only when the sequence actually moved
      if (p !== lastP) { lastP = p; invalidate.current?.(); }
      const h0 = blocks.current[0];
      if (h0) heroLayout.current = measureHeroLayout(el, h0);
      const ts = textState(p);
      blocks.current.forEach((b, i) => {
        if (!b) return;
        const { o, y } = ts[i];
        b.style.opacity = o.toFixed(3);
        b.style.setProperty('--ty', `${y.toFixed(1)}px`);
        b.dataset.visible = o > 0.02 ? 'true' : 'false';
        if (o > 0.02) b.removeAttribute('inert'); else b.setAttribute('inert', '');
      });
      const a = activeScene(p);
      dots.current?.querySelectorAll('i').forEach((d, i) => d.classList.toggle('active', i === a));
      // keep chasing until the sequence has caught up with the scroll position
      if (shown !== target) raf = requestAnimationFrame(update);
      else lastT = 0;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update(performance.now());
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    document.fonts?.ready.then(onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const layout = { mobile: caps.mobile };

  return (
    <section className="stage-track" ref={trackRef} aria-label="Product sequence">
      <div className="stage">
        <div className="stage-canvas" aria-hidden="true">
          {caps.webgl && (
            <Suspense fallback={null}>
              <StageCanvas progress={progress} intro={intro} heroLayout={heroLayout} layout={layout} lowPower={caps.lowPower} active={active} onReady={onReady} stats={showStats ? statsRef : undefined} invalidate={invalidate} />
            </Suspense>
          )}
        </div>

        <div className="overlay">
          {/* 1 · hero: centred copy at the top, the Limpet below (as on the existing site) */}
          <OverlayBlock refCb={(el) => (blocks.current[0] = el)} className="ob-top">
            <h1 className="h-display">{hero.headline}</h1>
            <p className="lead"><Lines text={hero.sub} /></p>
            <div className="cta-row">
              <Button href={site.links.preorder}>{hero.cta}</Button>
            </div>
          </OverlayBlock>

          {/* 2 · MacBook */}
          <OverlayBlock refCb={(el) => (blocks.current[1] = el)} className="ob-left backdrop" id="how-it-docks">
            <h2 className="h-1"><Lines text={scenes.macbook.headline} /></h2>
            <p className="lead">{scenes.macbook.body}</p>
            <p className="detail">{scenes.macbook.detail}</p>
          </OverlayBlock>

          {/* 3 · iPhone */}
          <OverlayBlock refCb={(el) => (blocks.current[2] = el)} className="ob-left backdrop">
            <h2 className="h-1"><Lines text={scenes.iphone.headline} /></h2>
            <p className="lead">{scenes.iphone.body}</p>
            <p className="detail">{scenes.iphone.detail}</p>
          </OverlayBlock>

          {/* 4 · first batch */}
          <OverlayBlock refCb={(el) => (blocks.current[3] = el)} className="ob-center">
            <h2 className="h-1"><Lines text={scenes.batch.headline} /></h2>
            <p className="lead">{scenes.batch.body}</p>
            <p className="price-line"><span className="from">From</span><span className="amount">{pricing.currency}{pricing.lite.launchPriceFrom}</span></p>
            <div className="cta-row">
              <Button href={site.links.preorder}>{scenes.batch.cta}</Button>
            </div>
          </OverlayBlock>
        </div>

        <div className="stage-progress" ref={dots} aria-hidden="true"><i className="active" /><i /><i /><i /></div>
        {showStats && <pre className="stage-stats" ref={statsRef} aria-hidden="true" />}
      </div>
    </section>
  );
}

function OverlayBlock({ children, className, refCb, id }: { children: React.ReactNode; className: string; refCb: (el: HTMLDivElement | null) => void; id?: string }) {
  return (
    <div className={`overlay-block ${className}`} ref={refCb} id={id} style={{ opacity: 0, translate: '0 var(--ty, 0px)' }} data-visible="false">
      {children}
    </div>
  );
}
