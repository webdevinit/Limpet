/**
 * Magnetic docking: timing of the snap and a scroll lock that holds the page while the magnet pulls.
 *
 * The lock never touches `overflow` (no layout shift, no scrollbar jump). It cancels wheel, touch and keyboard
 * scrolling and, as a fallback for everything it cannot cancel (scrollbar drags, native touch momentum), pins the
 * scroll position back on every scroll event.
 */

/** how long the pull takes from the trigger pose to contact (ms); shorter when it starts closer */
export const PULL_MS = { mac: 820, phone: 640 } as const;
/** the tiny rebound after contact (ms) and its size (share of the snap path) */
export const BUMP_MS = 170;
export const BUMP = 0.018;
/** the page stays locked at least this long after contact (ms) ... */
export const HOLD_MS = 260;
/** ... and then until wheel / touch input has been quiet this long (trackpad momentum would scroll straight on) ... */
export const QUIET_MS = 160;
/** ... but never longer than this after contact (ms) */
export const MAX_HOLD_MS = 2200;

/** magnetic pull: slow at first, then faster and faster until contact (a little initial speed, so it never stalls) */
export const pull = (t: number) => 0.22 * t + 0.78 * t * t * t;
/** rebound after contact: lifts a hair and settles, no spring wobble */
export const bump = (ms: number) => (ms <= 0 || ms >= BUMP_MS ? 0 : BUMP * Math.sin((Math.PI * ms) / BUMP_MS) * (1 - ms / BUMP_MS));

/** duration of a pull that starts at pose k0 for a zone with trigger pose `trigger` */
export function pullMs(device: keyof typeof PULL_MS, k0: number, trigger: number) {
  const full = PULL_MS[device];
  return Math.max(220, Math.min(full, full * Math.sqrt(Math.max(0, 1 - k0) / Math.max(0.01, 1 - trigger))));
}

const SCROLL_KEYS = new Set([' ', 'Spacebar', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
const editable = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

export class ScrollLock {
  private y = -1;
  /** last time the user tried to scroll while locked (ms, performance.now) */
  lastInput = 0;

  private onWheel = (e: WheelEvent) => { if (this.y < 0) return; this.lastInput = performance.now(); e.preventDefault(); };
  private onTouch = (e: TouchEvent) => { if (this.y < 0) return; this.lastInput = performance.now(); if (e.cancelable) e.preventDefault(); };
  private onKey = (e: KeyboardEvent) => {
    if (this.y < 0 || !SCROLL_KEYS.has(e.key) || editable(e.target)) return;
    this.lastInput = performance.now();
    e.preventDefault();
  };
  private onScroll = () => { if (this.y >= 0 && Math.abs(window.scrollY - this.y) > 1) this.pin(); };

  constructor() {
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('touchmove', this.onTouch, { passive: false });
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  get locked() { return this.y >= 0; }

  /** holds the page at y (document px); also moves it there right away */
  lock(y: number) { this.y = Math.max(0, y); this.lastInput = 0; this.pin(); }
  /** keeps the hold point current (resize while locked) */
  moveTo(y: number) { if (this.y >= 0 && Math.abs(this.y - y) > 0.5) { this.y = Math.max(0, y); this.pin(); } }
  unlock() { this.y = -1; }

  dispose() {
    this.unlock();
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('touchmove', this.onTouch);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('scroll', this.onScroll);
  }

  // the page has `scroll-behavior: smooth`; the hold must be instant
  private pin() { window.scrollTo({ top: this.y, behavior: 'instant' as ScrollBehavior }); }
}
