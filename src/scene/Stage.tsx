/**
 * Sticky scroll stage: native scrolling, a 100vh sticky viewport, a lazy WebGL canvas
 * and real HTML overlay copy per scene. The page-level loader covers the stage until the
 * models are decoded; then the Limpet glides in.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { activeScene, textState, MAGNETS, noMagnet, R, type MagnetZone } from './choreography';
import { ScrollLock, pull, bump, pullMs, BUMP_MS, HOLD_MS, QUIET_MS, MAX_HOLD_MS } from './magnet';
import { installAudioUnlock, playDock, soundEnabled, soundReady, setSoundEnabled, enableAndConfirm, onSoundChange, type Device } from './sound';
import { hero, scenes, pricing, site } from '../content';
import { Button, Lines } from '../components/ui';
import type { Capabilities } from '../hooks/useCapabilities';
import { emptyHeroLayout, measureHeroLayout } from './heroLayout';

const StageCanvas = lazy(() => import('./StageCanvas'));

/**
 * The sequence follows the scroll position, but never faster than this (progress per second before the finale; the
 * cap works on the scroll distance, so the finale, which has more scroll per unit of progress, is held back the same):
 * a hard flick still plays every move instead of jumping to the end.
 */
const MAX_SPEED = 0.2;
/** below the cap the sequence eases towards the scroll position at this rate (1/s), so small scrolls stay smooth */
const FOLLOW = 9;
/**
 * The finale (the Limpet turns, the pair forms) gets this much extra scroll room (vh) on top of its share of the
 * track; everything before it keeps its scroll length. Keep in sync with the `.stage-track` heights in styles.css.
 */
const FINALE_EXTRA_VH = 100;
/** scroll position on the track (0 … 1) to sequence progress, and back */
function finaleKnee(rangePx: number, vh: number) {
  const extra = Math.min(rangePx * 0.5, (FINALE_EXTRA_VH / 100) * vh);
  return (R.final[0] * (rangePx - extra)) / rangePx;
}
function toSequence(raw: number, rangePx: number, vh: number) {
  const k = finaleKnee(rangePx, vh), f = R.final[0];
  return raw < k ? (raw / k) * f : f + ((raw - k) / (1 - k)) * (1 - f);
}
function toScroll(p: number, rangePx: number, vh: number) {
  const k = finaleKnee(rangePx, vh), f = R.final[0];
  return p < f ? (p / f) * k : k + ((p - f) / (1 - f)) * (1 - k);
}
/** `?nochase=1` lets the sequence jump straight to the scroll position (for checks and screenshots) */
const NO_CHASE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('nochase');

export function Stage({ caps, onLoaded, intro, invalidate }: { caps: Capabilities; onLoaded: () => void; intro: React.MutableRefObject<number>; invalidate: React.MutableRefObject<(() => void) | null> }) {
  const trackRef = useRef<HTMLElement>(null);
  const progress = useRef(0);
  /** the magnet's pose while it pulls the Limpet onto a dock (read by the canvas) */
  const magnet = useRef(noMagnet());
  /** the moment the Limpet last touched a dock (performance.now, 0 = never): the canvas flashes the LED and nudges the camera */
  const contact = useRef<{ at: number; device: Device }>({ at: 0, device: 'mac' });
  const blocks = useRef<(HTMLDivElement | null)[]>([]);
  /** hero copy's bottom edge and the stage's offset from the page top (px); the canvas keeps the resting Limpet below the copy and inside the first screen */
  const heroLayout = useRef(emptyHeroLayout());
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
    let wasLive = false;
    const lock = new ScrollLock();
    installAudioUnlock();
    const armed = MAGNETS.map(() => false);
    /** the running snap: the magnet pulls the pose from k0 to 1 on a timer, then holds the page for a moment */
    let snap: { zone: MagnetZone; k0: number; p0: number; t0: number; pullMs: number; touched: boolean } | null = null;
    /** in-page navigation (anchor links): follow the scroll directly, no magnets, no speed cap */
    let nav = { on: false, since: 0 };
    let lastScrollAt = 0;
    const docY = (p: number) => {
      const range = el.offsetHeight - window.innerHeight;
      return el.getBoundingClientRect().top + window.scrollY + toScroll(p, range, window.innerHeight) * range;
    };

    const endSnap = () => {
      if (!snap) return;
      shown = snap.zone.dock;
      snap = null;
      magnet.current = noMagnet();
      lock.unlock();
    };

    const update = (now: number) => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const target = toSequence(Math.min(1, Math.max(0, -rect.top / (rect.height - vh))), rect.height - vh, vh);
      const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 1 / 60;
      lastT = now;
      // off screen (or on the first measure, e.g. a restored scroll position) there is nothing to watch: jump
      const visible = rect.bottom > 0 && rect.top < vh;
      if (nav.on && ((now - nav.since > 300 && now - lastScrollAt > 300) || now - nav.since > 4000)) nav = { on: false, since: 0 };
      // magnets only once the intro runs (the loader hides scroll restoration) and not while jumping to an anchor
      const live = intro.current > 0 && !nav.on && !NO_CHASE;

      if (snap) {
        const t = now - snap.t0;
        const z = snap.zone;
        let k: number;
        if (t < snap.pullMs) {
          k = snap.k0 + (1 - snap.k0) * pull(t / snap.pullMs);
          shown = snap.p0 + (z.dock - snap.p0) * (t / snap.pullMs);
        } else {
          const after = t - snap.pullMs;
          if (!snap.touched) { snap.touched = true; contact.current = { at: now, device: z.device }; playDock(z.device); buzz(z.device); }
          k = 1 - bump(after);
          shown = z.dock;
          const quiet = now - lock.lastInput > QUIET_MS;
          if ((after > BUMP_MS + HOLD_MS && quiet) || after > MAX_HOLD_MS) { endSnap(); k = 1; }
        }
        if (snap) { magnet.current = { id: z.id, k, contact: t >= snap.pullMs }; lock.moveTo(docY(z.dock)); }
        invalidate.current?.();
      } else {
        const prev = shown;
        if (shown < 0 || !visible || NO_CHASE || nav.on) shown = target;
        else {
          // chase in scroll space: the same scroll distance per second everywhere, finale included
          const range = rect.height - vh;
          const rs = toScroll(shown, range, vh), rt = toScroll(target, range, vh);
          const cap = (MAX_SPEED * finaleKnee(range, vh)) / R.final[0];
          const d = rt - rs;
          const step = Math.min(Math.abs(d), Math.max(Math.abs(d) * FOLLOW, 0.002) * dt, cap * dt);
          const next = rs + Math.sign(d) * step;
          shown = Math.abs(rt - next) < 1e-5 ? target : toSequence(next, range, vh);
        }
        // magnets: arm once the pose is clearly away from the dock, snap when it comes back past the trigger
        const dir = Math.sign(shown - prev);
        const entering = live && visible && !wasLive;
        MAGNETS.forEach((z, i) => {
          const k = z.param(shown);
          if (k <= z.rearm) armed[i] = true;
          if (!live || !visible || snap) return;
          if (k < z.trigger || k >= 1) return;
          // (re)entering live mode inside a snap window (reload mid-dock, end of an anchor jump): just be docked
          if (entering) { armed[i] = false; shown = z.dock; lock.lock(docY(z.dock)); lock.unlock(); return; }
          const toward = z.dock > z.far ? dir > 0 : dir < 0;
          if (armed[i] && toward) {
            armed[i] = false;
            snap = { zone: z, k0: k, p0: shown, t0: now, pullMs: pullMs(z.device, k, z.trigger), touched: false };
            magnet.current = { id: z.id, k, contact: false };
            lock.lock(docY(z.dock));
          }
        });
        wasLive = live && visible;
      }

      const p = shown;
      progress.current = p;
      if (import.meta.env.DEV) (window as unknown as { __stage?: unknown }).__stage = { shown, target, snap: snap?.zone.id ?? null, k: magnet.current.k, locked: lock.locked, armed: [...armed], nav: nav.on };
      // the canvas renders on demand: ask for a frame only when the sequence actually moved
      if (p !== lastP) { lastP = p; invalidate.current?.(); }
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
      // keep going while the magnet pulls or the sequence still chases the scroll position
      if (snap || shown !== target) raf = requestAnimationFrame(update);
      else lastT = 0;
    };
    // the hero copy's extent only changes with the layout, so it is measured on resize / font load, not per frame
    const measure = () => { const h0 = blocks.current[0]; if (h0) heroLayout.current = measureHeroLayout(el, h0); };
    const onScroll = () => { lastScrollAt = performance.now(); if (!raf) raf = requestAnimationFrame(update); };
    const onResize = () => { measure(); onScroll(); };
    // anchor links jump through the sequence without stopping at the docks
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
      if (a && a.getAttribute('href') !== '#') { endSnap(); nav = { on: true, since: performance.now() }; }
    };
    // a hidden tab gets no frames: finish a running snap instead of leaving the page locked
    const onVisibility = () => { if (document.hidden) endSnap(); };
    // the intro starting (loader fading) turns the magnets on
    const kick = setInterval(() => { if (intro.current > 0) { clearInterval(kick); onScroll(); } }, 100);
    measure();
    update(performance.now());
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('click', onClick, true);
    document.addEventListener('visibilitychange', onVisibility);
    document.fonts?.ready.then(onResize);
    return () => {
      window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize);
      document.removeEventListener('click', onClick, true); document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(kick);
      if (raf) cancelAnimationFrame(raf);
      lock.dispose();
    };
  }, []);

  const layout = { mobile: caps.mobile };

  return (
    <section className="stage-track" ref={trackRef} aria-label="Product sequence">
      <div className="stage">
        <div className="stage-canvas" aria-hidden="true">
          {caps.webgl && (
            <Suspense fallback={null}>
              <StageCanvas progress={progress} magnet={magnet} contact={contact} intro={intro} heroLayout={heroLayout} layout={layout} lowPower={caps.lowPower} active={active} onReady={onReady} invalidate={invalidate} />
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
        {caps.webgl && <SoundToggle />}
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

/**
 * Speaker button on the stage: the docking sounds on / off (remembered per browser). Until the browser allows audio
 * (no click or tap yet; scrolling does not count) it shows a small "Sound" label, so a visitor knows a click turns it on.
 */
function SoundToggle() {
  const [state, setState] = useState(() => ({ on: soundEnabled(), ready: soundReady() }));
  useEffect(() => onSoundChange(() => setState({ on: soundEnabled(), ready: soundReady() })), []);
  const { on, ready } = state;
  // the label stays a moment after audio unlocks: the press on the pill itself unlocks it, and the pill must not
  // shrink away under the pointer before the click lands (that click plays the confirming blopp)
  const [invite, setInvite] = useState(on && !ready);
  useEffect(() => {
    if (on && !ready) { setInvite(true); return; }
    const t = setTimeout(() => setInvite(false), 700);
    return () => clearTimeout(t);
  }, [on, ready]);
  const label = invite ? 'Turn on docking sounds' : on ? 'Mute docking sounds' : 'Play docking sounds';
  return (
    <button
      type="button" className={`stage-sound${invite ? ' invite' : ''}`} aria-pressed={on && ready} aria-label={label} title={label}
      onClick={() => (invite || !on ? enableAndConfirm() : setSoundEnabled(false))}
    >
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3z" fill="currentColor" stroke="none" />
        {on && ready ? (<><path d="M13.5 7.2a3.6 3.6 0 0 1 0 5.6" /><path d="M15.6 5a6.6 6.6 0 0 1 0 10" /></>) : (<><path d="M13.5 7.5l5 5" /><path d="M18.5 7.5l-5 5" /></>)}
      </svg>
      {invite && <span>Sound</span>}
    </button>
  );
}

/** experimental: a tiny haptic tick at contact on phones that support it (Android; iOS browsers have no vibration) */
function buzz(device: Device) {
  const nav = navigator as Navigator & { userActivation?: { hasBeenActive: boolean } };
  if (!nav.vibrate || !nav.userActivation?.hasBeenActive) return;
  try { nav.vibrate(device === 'mac' ? 14 : 9); } catch { /* ignored */ }
}
