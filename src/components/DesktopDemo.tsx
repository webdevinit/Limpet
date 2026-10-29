/**
 * Looping macOS-style desktop demo: the pointer right-clicks a folder, chooses
 * "Save to Limpet", and the folder gets a small orange Limpet badge — without moving.
 * Pure HTML/CSS/JS, no screenshots of macOS are used. The pointer is tweened in JS and the
 * menu hover state is hit-tested from the pointer's real position every frame.
 */
import { useEffect, useRef } from 'react';

const MENU_ITEMS: { label: string; sep?: boolean; sub?: boolean; limpet?: boolean; tags?: boolean }[] = [
  { label: 'Open' },
  { label: 'Move to Trash', sep: true },
  { label: 'Get Info' },
  { label: 'Rename' },
  { label: 'Compress “Projects”' },
  { label: 'Duplicate' },
  { label: 'Make Alias' },
  { label: 'Quick Look', sep: true },
  { label: 'Copy' },
  { label: 'Share…', sep: true },
  { label: 'Save to Limpet', limpet: true, sep: true },
  { label: '', tags: true },
  { label: 'Tags…', sep: true },
  { label: 'Quick Actions', sub: true },
];
const TARGET = MENU_ITEMS.findIndex((i) => i.limpet);

// timeline (ms)
const T = { move: 700, atFolder: 1800, menu: 2000, walk: 2400, reach: 3900, click: 4150, closed: 4500, badge: 4800, leave: 7600, end: 8600 };
const FOLDER = { x: 37, y: 24 }; // percent of the desk
const START = { x: 12, y: 82 };
const ease = (s: number) => (s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2);
const lerp = (a: number, b: number, s: number) => a + (b - a) * s;

export function DesktopDemo({ reduced }: { reduced: boolean }) {
  const deskRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<SVGSVGElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const desk = deskRef.current, pointer = pointerRef.current, menu = menuRef.current, badge = badgeRef.current;
    if (!desk || !pointer || !menu || !badge) return;
    if (reduced) {
      menu.classList.add('open');
      itemRefs.current[TARGET]?.classList.add('hover');
      badge.classList.add('show');
      pointer.style.display = 'none';
      return;
    }
    let raf = 0;
    let start = performance.now();
    // (re)start the loop when the demo scrolls into view, so the sequence always begins at the folder
    let running = false;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) { running = true; start = performance.now(); badge.classList.remove('show'); raf = requestAnimationFrame(frame); }
      else if (!e.isIntersecting && running) { running = false; cancelAnimationFrame(raf); }
    }, { threshold: 0.25 });
    io.observe(desk);
    let hovered = -1;
    let rects: { top: number; bottom: number; left: number; right: number }[] = [];
    let tx = FOLDER.x + 4, ty = FOLDER.y + 10; // last pointer position on the target item (kept after the menu closes)
    const pct = (px: number, total: number) => (px / total) * 100;
    const measure = () => {
      const d = desk.getBoundingClientRect();
      rects = itemRefs.current.map((el) => {
        if (!el) return { top: -1, bottom: -1, left: -1, right: -1 };
        const r = el.getBoundingClientRect();
        return { top: pct(r.top - d.top, d.height), bottom: pct(r.bottom - d.top, d.height), left: pct(r.left - d.left, d.width), right: pct(r.right - d.left, d.width) };
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
      if (t > T.end) { start = now; badge.classList.remove('show'); }
      let x = START.x, y = START.y;
      let menuOpen = false, flash = false, showBadge = false;
      if (t < T.move) { /* idle */ }
      else if (t < T.atFolder) { const s = ease((t - T.move) / (T.atFolder - T.move)); x = lerp(START.x, FOLDER.x + 4, s); y = lerp(START.y, FOLDER.y + 10, s); }
      else if (t < T.walk) { x = FOLDER.x + 4; y = FOLDER.y + 10; menuOpen = t >= T.menu; }
      else if (t < T.reach) {
        menuOpen = true;
        if (!rects.length || rects[0].top < 0) measure();
        const first = rects[0], target = rects[TARGET];
        const s = ease((t - T.walk) / (T.reach - T.walk));
        const x0 = FOLDER.x + 4, y0 = FOLDER.y + 10;
        const xm = (first.left + first.right) / 2 + 2, ym0 = (first.top + first.bottom) / 2, ym1 = (target.top + target.bottom) / 2;
        // a short diagonal onto the first item, then straight down the list
        const sIn = Math.min(1, s / 0.18), sDown = Math.max(0, (s - 0.18) / 0.82);
        x = lerp(x0, xm, sIn); y = sIn < 1 ? lerp(y0, ym0, sIn) : lerp(ym0, ym1, sDown);
        tx = xm; ty = ym1;
      }
      else if (t < T.click) { menuOpen = true; x = tx; y = ty; }
      else if (t < T.closed) { menuOpen = true; x = tx; y = ty; flash = Math.floor((t - T.click) / 90) % 2 === 0; }
      else if (t < T.leave) { x = tx; y = ty; showBadge = t >= T.badge; }
      else { const s = ease((t - T.leave) / (T.end - T.leave)); x = lerp(tx, START.x, s); y = lerp(ty, START.y, s); showBadge = true; }

      pointer.style.left = `${x}%`; pointer.style.top = `${y}%`;
      menu.classList.toggle('open', menuOpen);
      if (menuOpen) {
        if (!rects.length || rects[0].top < 0) measure();
        let hit = -1;
        for (let i = 0; i < rects.length; i++) { const r = rects[i]; if (MENU_ITEMS[i].tags) continue; if (y >= r.top && y <= r.bottom && x >= r.left && x <= r.right) { hit = i; break; } }
        setHover(hit);
        itemRefs.current[TARGET]?.classList.toggle('flash', flash);
      } else { setHover(-1); rects = []; }
      badge.classList.toggle('show', showBadge);
      if (running) raf = requestAnimationFrame(frame);
    };
    const onResize = () => { rects = []; };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('resize', onResize); };
  }, [reduced]);

  return (
    <div className="desk-scene" role="img" aria-label="macOS desktop: right-clicking a folder shows a “Save to Limpet” option. After choosing it, the folder stays in place and gets a small orange Limpet badge.">
      <div className="desk" ref={deskRef}>
        <Wallpaper />
        <MenuBar />
        <div className="desk-widgets" aria-hidden="true">
          <div className="widget cal">
            <div className="cal-h"><span>September</span><span className="cal-y">2026</span></div>
            <div className="cal-g">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <i key={'d' + i}>{d}</i>)}
              {Array.from({ length: 30 }, (_, i) => <span key={i} className={i === 9 ? 'today' : ''}>{i + 1}</span>)}
            </div>
          </div>
          <div className="widget weather">
            <div className="w-top"><span className="w-city">Memphis</span><span className="w-icon">☀︎</span></div>
            <div className="w-temp">82°</div>
            <div className="w-note">Sunny · H:88° L:71°</div>
          </div>
        </div>

        <div className="desk-folder" style={{ left: `${FOLDER.x}%`, top: `${FOLDER.y}%` }}>
          <FolderIcon />
          <span className="limpet-badge" ref={badgeRef} aria-hidden="true"><LimpetBadgeMark /></span>
          <span className="label">Projects</span>
        </div>

        <div className="ctx" ref={menuRef} style={{ left: `${FOLDER.x + 5}%`, top: `${FOLDER.y + 11}%` }} aria-hidden="true">
          {MENU_ITEMS.map((it, idx) => {
            if (it.tags) return (
              <div className="ctx-tags" key="tags" ref={(el) => (itemRefs.current[idx] = el)}>
                {['#ff5257', '#ff9d0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2', '#8e8e93'].map((c) => <i key={c} style={{ background: c }} />)}
              </div>
            );
            return (
              <div className={`ctx-item${it.sep ? ' sep' : ''}`} key={it.label} ref={(el) => (itemRefs.current[idx] = el)}>
                {it.limpet && <i className="ctx-limpet"><LimpetBadgeMark /></i>}
                <span>{it.label}</span>
                {it.sub && <span className="chev">›</span>}
              </div>
            );
          })}
        </div>

        <svg className="desk-pointer" ref={pointerRef} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 3l14 9.5-6.2 1 3.4 6.4-2.6 1.4-3.4-6.5L5 19.5z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function MenuBar() {
  return (
    <div className="desk-menubar" aria-hidden="true">
      <span className="apple"></span>
      <b>Finder</b><span>File</span><span>Edit</span><span>View</span><span>Go</span><span>Window</span><span>Help</span>
      <span className="right">
        <svg viewBox="0 0 24 24" className="ic"><path d="M2.5 9.5a14 14 0 0 1 19 0M5.5 12.8a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="19.3" r="1.6" fill="currentColor" /></svg>
        <svg viewBox="0 0 30 16" className="ic batt"><rect x="1" y="2" width="24" height="12" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><rect x="3" y="4" width="18" height="8" rx="2" fill="currentColor" /><path d="M27 6v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M13.5 2.5 10 9h3l-1 4.5L16 7h-3z" fill="#fff" /></svg>
        <svg viewBox="0 0 24 24" className="ic"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="m15.5 15.5 5 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
        <svg viewBox="0 0 24 24" className="ic"><rect x="2" y="4" width="20" height="7" rx="3.5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="6" cy="7.5" r="2.2" fill="currentColor" /><rect x="2" y="13" width="20" height="7" rx="3.5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="18" cy="16.5" r="2.2" fill="currentColor" /></svg>
        <span className="clock">Wed Apr 1&nbsp;&nbsp;9:41 AM</span>
      </span>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 100 80" className="folder-svg" aria-hidden="true">
      <defs>
        <linearGradient id="fb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6fb6f6" /><stop offset="1" stopColor="#3f93e6" /></linearGradient>
        <linearGradient id="ff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fd2ff" /><stop offset="1" stopColor="#5aa9f3" /></linearGradient>
      </defs>
      <path d="M6 14 q0-6 6-6 h24 l8 7 h44 q6 0 6 6 v46 q0 6-6 6 H12 q-6 0-6-6z" fill="url(#fb)" />
      <path d="M6 30 q0-6 6-6 h76 q6 0 6 6 v37 q0 6-6 6 H12 q-6 0-6-6z" fill="url(#ff)" />
      <path d="M6 30 q0-6 6-6 h76 q6 0 6 6 v4 H6z" fill="#fff" opacity=".25" />
    </svg>
  );
}

function LimpetBadgeMark() {
  return (
    <svg viewBox="0 0 760 440" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path strokeWidth="60" d="M 70 400 L 455 108 C 478 90 505 86 530 100 C 548 110 560 130 572 160 L 690 395 C 700 410 690 414 672 414 L 90 414 C 66 414 58 408 70 400 Z" />
      <path strokeWidth="44" d="M 200 396 C 330 392 420 330 548 172" />
      <path strokeWidth="44" d="M 385 402 C 490 398 530 350 618 270" />
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
