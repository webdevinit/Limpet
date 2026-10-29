/**
 * Looping macOS-style desktop demo, after the real recording: the pointer right-clicks the "Screenshots" folder,
 * chooses "Offload to Limpet…" at the bottom of the (dark) context menu, the folder gets a small Limpet badge and a
 * cloud after its name, and the Limpet icon in the menu bar shows a spinning ring while the files move.
 * Pure HTML/CSS/JS, no screenshots of macOS are used. The pointer is tweened in JS and the menu hover state is
 * hit-tested from the pointer's real position every frame.
 */
import { useEffect, useRef } from 'react';

type IconKind = 'siri' | 'bin' | 'share' | 'tag' | 'phone' | 'gear';
const MENU_ITEMS: { label: string; sep?: boolean; sub?: boolean; icon?: IconKind; tags?: boolean; boxed?: boolean; target?: boolean }[] = [
  { label: 'Ask Siri', icon: 'siri', boxed: true },
  { label: 'Open' },
  { label: 'Remove Download' },
  { label: 'Keep Downloaded', sep: true },
  { label: 'Move to Bin', icon: 'bin', sep: true },
  { label: 'Get Info' },
  { label: 'Rename' },
  { label: 'Compress “Screenshots”' },
  { label: 'Duplicate' },
  { label: 'Make Alias' },
  { label: 'Quick Look' },
  { label: 'Copy', sep: true },
  { label: 'Share…', icon: 'share', sep: true },
  { label: '', tags: true },
  { label: 'Customise Folder…', icon: 'tag', sep: true },
  { label: 'Import from iPhone', icon: 'phone', sub: true },
  { label: 'Quick Actions', icon: 'gear', sub: true, sep: true },
  { label: 'Offload to Limpet…', target: true },
];
const TARGET = MENU_ITEMS.findIndex((i) => i.target);

// timeline (ms)
const T = { move: 700, atFolder: 1800, menu: 2000, walk: 2400, reach: 4300, click: 4550, closed: 4850, offload: 5450, synced: 9800, leave: 11400, end: 12400 };
const FOLDER = { x: 33, y: 17 }; // percent of the desk (phones: see FOLDER_Y_PHONE)
const FOLDER_Y_PHONE = 9; // the long menu must stay inside the short desk
const folderY = () => (typeof window !== 'undefined' && window.matchMedia('(max-width: 480px)').matches ? FOLDER_Y_PHONE : FOLDER.y);
const START = { x: 12, y: 84 };
const ease = (s: number) => (s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2);
const lerp = (a: number, b: number, s: number) => a + (b - a) * s;

export function DesktopDemo({ reduced }: { reduced: boolean }) {
  const deskRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<SVGSVGElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const folderRef = useRef<HTMLDivElement>(null);
  const syncRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fy = folderY();

  useEffect(() => {
    const desk = deskRef.current, pointer = pointerRef.current, menu = menuRef.current, folder = folderRef.current, sync = syncRef.current;
    if (!desk || !pointer || !menu || !folder || !sync) return;
    if (reduced) {
      menu.classList.add('open');
      itemRefs.current[TARGET]?.classList.add('hover');
      folder.classList.add('offloaded');
      pointer.style.display = 'none';
      return;
    }
    let raf = 0;
    let start = performance.now();
    // (re)start the loop when the demo scrolls into view, so the sequence always begins at the folder
    let running = false;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) { running = true; start = performance.now(); folder.classList.remove('offloaded'); raf = requestAnimationFrame(frame); }
      else if (!e.isIntersecting && running) { running = false; cancelAnimationFrame(raf); }
    }, { threshold: 0.25 });
    io.observe(desk);
    let hovered = -1;
    let deskW = 0, deskH = 0;
    let rects: { top: number; bottom: number; left: number; right: number }[] = [];
    let tx = FOLDER.x + 4, ty = fy + 10; // last pointer position on the target item (kept after the menu closes)
    const pct = (px: number, total: number) => (px / total) * 100;
    // menu items in the desk's own layout coordinates (offsets), the same space the pointer moves in. Screen rects
    // would be wrong twice: the desk is tilted in 3D, and the menu is still scaling open when it is first measured.
    const measure = () => {
      const W = desk.offsetWidth, H = desk.offsetHeight;
      if (!W || !H) return;
      const mx = menu.offsetLeft, my = menu.offsetTop;
      rects = itemRefs.current.map((el) => {
        if (!el) return { top: -1, bottom: -1, left: -1, right: -1 };
        const l = mx + el.offsetLeft, t = my + el.offsetTop;
        return { top: pct(t, H), bottom: pct(t + el.offsetHeight, H), left: pct(l, W), right: pct(l + el.offsetWidth, W) };
      });
    };
    const setHover = (i: number) => {
      if (i === hovered) return;
      itemRefs.current[hovered]?.classList.remove('hover');
      hovered = i;
      itemRefs.current[hovered]?.classList.add('hover');
    };
    const frame = (now: number) => {
      const t = now - start;
      if (t > T.end) { start = now; folder.classList.remove('offloaded'); }
      let x = START.x, y = START.y;
      let menuOpen = false, flash = false, offloaded = false, syncing = false, selected = false;
      if (t < T.move) { /* idle */ }
      else if (t < T.atFolder) { const s = ease((t - T.move) / (T.atFolder - T.move)); x = lerp(START.x, FOLDER.x + 4, s); y = lerp(START.y, fy + 10, s); }
      else if (t < T.walk) { x = FOLDER.x + 4; y = fy + 10; menuOpen = t >= T.menu; selected = menuOpen; }
      else if (t < T.reach) {
        menuOpen = true; selected = true;
        if (!rects.length || rects[0].top < 0) measure();
        const first = rects[0], target = rects[TARGET];
        const s = ease((t - T.walk) / (T.reach - T.walk));
        const x0 = FOLDER.x + 4, y0 = fy + 10;
        const xm = (first.left + first.right) / 2 + 2, ym0 = (first.top + first.bottom) / 2, ym1 = (target.top + target.bottom) / 2;
        // a short diagonal onto the first item, then straight down the list
        const sIn = Math.min(1, s / 0.18), sDown = Math.max(0, (s - 0.18) / 0.82);
        x = lerp(x0, xm, sIn); y = sIn < 1 ? lerp(y0, ym0, sIn) : lerp(ym0, ym1, sDown);
        tx = xm; ty = ym1;
      }
      else if (t < T.click) { menuOpen = true; selected = true; x = tx; y = ty; }
      else if (t < T.closed) { menuOpen = true; selected = true; x = tx; y = ty; flash = Math.floor((t - T.click) / 90) % 2 === 0; }
      else if (t < T.leave) { x = tx; y = ty; offloaded = t >= T.offload; syncing = t >= T.offload && t < T.synced; selected = t < T.offload + 900; }
      else { const s = ease((t - T.leave) / (T.end - T.leave)); x = lerp(tx, START.x, s); y = lerp(ty, START.y, s); offloaded = true; }

      // a transform instead of left/top: no layout of the 3D-tilted, masked desk on every frame
      if (!deskW) { deskW = desk.offsetWidth; deskH = desk.offsetHeight; }
      pointer.style.transform = `translate3d(${(x / 100 * deskW).toFixed(1)}px, ${(y / 100 * deskH).toFixed(1)}px, 0)`;
      menu.classList.toggle('open', menuOpen);
      if (menuOpen) {
        if (!rects.length || rects[0].top < 0) measure();
        let hit = -1;
        for (let i = 0; i < rects.length; i++) { const r = rects[i]; if (MENU_ITEMS[i].tags) continue; if (y >= r.top && y <= r.bottom && x >= r.left && x <= r.right) { hit = i; break; } }
        setHover(hit);
        itemRefs.current[TARGET]?.classList.toggle('flash', flash);
      } else { setHover(-1); rects = []; }
      folder.classList.toggle('offloaded', offloaded);
      folder.classList.toggle('selected', selected);
      sync.classList.toggle('on', syncing);
      if (running) raf = requestAnimationFrame(frame);
    };
    const onResize = () => { rects = []; deskW = 0; deskH = 0; };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('resize', onResize); };
  }, [reduced, fy]);

  return (
    <div className="desk-scene" role="img" aria-label="macOS desktop: right-clicking the Screenshots folder shows an Offload to Limpet option. After choosing it, the folder stays in place, gets a small Limpet badge and a cloud next to its name, and the Limpet icon in the menu bar shows a spinning ring while the files move.">
      <div className="desk" ref={deskRef}>
        <Wallpaper />
        <MenuBar syncRef={syncRef} />
        <div className="desk-widgets" aria-hidden="true">
          <div className="widget cal">
            <div className="cal-h"><span>September</span><span className="cal-y">2026</span></div>
            <div className="cal-g">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <i key={'d' + i}>{d}</i>)}
              {Array.from({ length: 30 }, (_, i) => <span key={i} className={i === 9 ? 'today' : ''}>{i + 1}</span>)}
            </div>
          </div>
          <div className="widget weather">
            <div className="w-top"><span className="w-city">London</span><span className="w-icon">☁︎</span></div>
            <div className="w-temp">14°</div>
            <div className="w-note">Cloudy · H:16° L:9°</div>
          </div>
        </div>

        <div className="desk-folder" style={{ left: `${FOLDER.x - 16}%`, top: `${fy}%` }}>
          <FolderIcon />
          <span className="label">Design<br />Competitions</span>
        </div>
        <div className="desk-folder" ref={folderRef} style={{ left: `${FOLDER.x}%`, top: `${fy}%` }}>
          <FolderIcon />
          <span className="limpet-badge" aria-hidden="true"><LimpetDeviceMark /></span>
          <span className="label">Screenshots<CloudMark /></span>
        </div>

        <div className="ctx" ref={menuRef} style={{ left: `${FOLDER.x + 5}%`, top: `${fy + 10}%` }} aria-hidden="true">
          {MENU_ITEMS.map((it, idx) => {
            if (it.tags) return (
              <div className="ctx-tags" key="tags" ref={(el) => (itemRefs.current[idx] = el)}>
                {['#ff5257', '#ff9d0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2', '#8e8e93'].map((c) => <i key={c} style={{ background: c }} />)}
              </div>
            );
            return (
              <div className={`ctx-item${it.sep ? ' sep' : ''}${it.boxed ? ' boxed' : ''}`} key={it.label} ref={(el) => (itemRefs.current[idx] = el)}>
                {it.icon && <MenuIcon kind={it.icon} />}
                <span>{it.label}</span>
                {it.sub && <span className="chev">›</span>}
              </div>
            );
          })}
        </div>

        <Dock />

        <svg className="desk-pointer" ref={pointerRef} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 3l14 9.5-6.2 1 3.4 6.4-2.6 1.4-3.4-6.5L5 19.5z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

/** the Limpet seen from above: a rounded shell with the tray outline and the LED (the menu bar icon, also the folder badge) */
function LimpetDeviceMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeLinejoin="round">
      <rect x="6" y="2.2" width="12" height="19.6" rx="4" strokeWidth="1.9" />
      <rect x="8.3" y="4.6" width="7.4" height="14.8" rx="2.4" strokeWidth="1.1" opacity=".9" />
      <circle cx="14.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CloudMark() {
  return (
    <svg className="cloud" viewBox="0 0 24 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M6.5 14h11a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.6 5.2 4.4 4.4 0 0 0 6.5 14z" />
    </svg>
  );
}

function MenuIcon({ kind }: { kind: IconKind }) {
  return (
    <svg className="ctx-ic" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'siri' && <><circle cx="10" cy="10" r="7" /><path d="M4 11.5c3-2 9-2 12 0" /></>}
      {kind === 'bin' && <path d="M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6" />}
      {kind === 'share' && <path d="M10 12V3M6.5 6.5 10 3l3.5 3.5M5 10v7h10v-7" />}
      {kind === 'tag' && <><path d="M3 10.5 10.5 3H17v6.5L9.5 17z" /><circle cx="13.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></>}
      {kind === 'phone' && <><rect x="6" y="2.5" width="8" height="15" rx="2" /><path d="M9 15h2" /></>}
      {kind === 'gear' && <><circle cx="10" cy="10" r="2.6" /><path d="M10 3v2.2M10 14.8V17M3 10h2.2M14.8 10H17M5.05 5.05l1.55 1.55M13.4 13.4l1.55 1.55M5.05 14.95l1.55-1.55M13.4 6.6l1.55-1.55" /></>}
    </svg>
  );
}

function MenuBar({ syncRef }: { syncRef: React.RefObject<HTMLSpanElement> }) {
  return (
    <div className="desk-menubar" aria-hidden="true">
      <span className="apple"></span>
      <b>Finder</b><span>File</span><span>Edit</span><span>View</span><span>Go</span><span>Window</span><span>Help</span>
      <span className="right">
        <span className="limpet-status"><LimpetDeviceMark /><span className="sync" ref={syncRef} /></span>
        <svg viewBox="0 0 30 16" className="ic batt"><rect x="1" y="2" width="24" height="12" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><rect x="3" y="4" width="18" height="8" rx="2" fill="currentColor" /><path d="M27 6v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <svg viewBox="0 0 24 24" className="ic"><path d="M2.5 9.5a14 14 0 0 1 19 0M5.5 12.8a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="19.3" r="1.6" fill="currentColor" /></svg>
        <svg viewBox="0 0 24 24" className="ic"><rect x="2" y="4" width="20" height="7" rx="3.5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="6" cy="7.5" r="2.2" fill="currentColor" /><rect x="2" y="13" width="20" height="7" rx="3.5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="18" cy="16.5" r="2.2" fill="currentColor" /></svg>
        <span className="clock">Thu 29 Oct&nbsp;&nbsp;21:58</span>
      </span>
    </div>
  );
}

/** a dock of generic app tiles (no real app icons) */
function Dock() {
  const tiles = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#f97316', '#06b6d4', '#e11d48', '#22c55e', '#64748b', '#a855f7', '#0ea5e9'];
  return (
    <div className="desk-dock" aria-hidden="true">
      {tiles.map((c, i) => <i key={i} style={{ background: `linear-gradient(160deg, ${c}, ${c}aa)` }} />)}
    </div>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 100 80" className="folder-svg" aria-hidden="true">
      <defs>
        <linearGradient id="fb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5fb0f5" /><stop offset="1" stopColor="#2f86e0" /></linearGradient>
        <linearGradient id="ff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8fcbff" /><stop offset="1" stopColor="#49a0f0" /></linearGradient>
      </defs>
      <path d="M6 14 q0-6 6-6 h24 l8 7 h44 q6 0 6 6 v46 q0 6-6 6 H12 q-6 0-6-6z" fill="url(#fb)" />
      <path d="M6 30 q0-6 6-6 h76 q6 0 6 6 v37 q0 6-6 6 H12 q-6 0-6-6z" fill="url(#ff)" />
      <path d="M6 30 q0-6 6-6 h76 q6 0 6 6 v4 H6z" fill="#fff" opacity=".25" />
    </svg>
  );
}

function Wallpaper() {
  return (
    <svg className="desk-wall" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="wbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#dcd5cb" /><stop offset=".5" stopColor="#c9c5c8" /><stop offset="1" stopColor="#8e97ad" /></linearGradient>
        <linearGradient id="wb1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#f3ede4" /><stop offset="1" stopColor="#bfb3a6" /></linearGradient>
        <linearGradient id="wb2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#dfe4ec" /><stop offset="1" stopColor="#7d8aa6" /></linearGradient>
        <linearGradient id="wb3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity=".9" /><stop offset="1" stopColor="#a8b0c2" stopOpacity=".6" /></linearGradient>
        <filter id="wblur"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <rect width="1200" height="900" fill="url(#wbg)" />
      <path d="M-100 700 C 250 640, 380 380, 520 200 C 640 40, 900 120, 1300 260 L 1300 1000 L -100 1000 Z" fill="url(#wb2)" opacity=".85" filter="url(#wblur)" />
      <path d="M-100 780 C 300 720, 420 460, 560 300 C 680 160, 950 200, 1300 340 L 1300 1000 L -100 1000 Z" fill="url(#wb1)" opacity=".9" />
      <path d="M-100 840 C 320 800, 470 560, 600 410 C 720 280, 980 300, 1300 420 L 1300 1000 L -100 1000 Z" fill="url(#wb3)" />
      <path d="M-100 900 C 360 870, 520 660, 640 520 C 760 380, 1010 400, 1300 500 L 1300 1000 L -100 1000 Z" fill="#7f8aa3" opacity=".8" />
      <path d="M 180 1000 C 420 840, 560 680, 680 560" stroke="#fff" strokeOpacity=".5" strokeWidth="2" fill="none" />
    </svg>
  );
}
