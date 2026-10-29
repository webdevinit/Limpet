import type { ReactNode } from 'react';
import type { Text as TText } from '../content';

/** Renders either plain text or a clearly marked placeholder. */
export function T({ v }: { v: TText }) {
  if (typeof v === 'string') return <>{v}</>;
  return <span className="tbd" title="Placeholder — not confirmed">{v.text}</span>;
}

/** Copy with explicit line breaks ('\n' in content.ts): each line is its own block. */
export function Lines({ text }: { text: string }) {
  return <>{text.split('\n').map((l, i) => <span key={i} className="line">{l}</span>)}</>;
}

/** Limpet shell mark (orange outline with growth ridges), after the supplied logo artwork. */
export function LimpetMark({ className, draw, color = '#ff6935' }: { className?: string; draw?: boolean; color?: string }) {
  return (
    <svg className={className} viewBox="0 0 760 440" aria-hidden="true" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <path className={draw ? 'draw' : undefined} strokeWidth="22" d="M 70 400 L 455 108 C 478 90 505 86 530 100 C 548 110 560 130 572 160 L 690 395 C 700 410 690 414 672 414 L 90 414 C 66 414 58 408 70 400 Z" />
      <g strokeWidth="14" className={draw ? 'draw ridges' : undefined}>
        <path d="M 150 388 C 260 380 370 300 486 125" />
        <path d="M 200 396 C 330 392 420 330 548 172" />
        <path d="M 270 400 C 400 396 470 340 586 220" />
        <path d="M 385 402 C 490 398 530 350 618 270" />
        <path d="M 500 404 C 560 400 580 370 636 322" />
      </g>
    </svg>
  );
}

/** Pat Pending face: two heavy-lidded eyes and a small smile, after the supplied artwork. */
export function PatPendingFace({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1024 420" aria-hidden="true" fill="none" stroke="#1d1d1f" strokeLinecap="round" strokeLinejoin="round">
      <g className="eye eye-l">
        <path strokeWidth="54" d="M 28 118 L 330 48" />
        <path strokeWidth="54" d="M 330 48 L 372 182 C 392 250 330 290 270 262 C 232 244 215 205 215 160" />
      </g>
      <g className="eye eye-r">
        <path strokeWidth="54" d="M 996 118 L 694 48" />
        <path strokeWidth="54" d="M 694 48 L 652 182 C 632 250 694 290 754 262 C 792 244 809 205 809 160" />
      </g>
      <path className="mouth" strokeWidth="46" d="M 446 330 C 460 392 564 392 578 330" />
    </svg>
  );
}

/** Shopping bag outline, as on the existing site's header. */
export function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7.5h14l1 13H4l1-13Z" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    </svg>
  );
}

export function Button({ href, children, variant, size, onClick, ariaLabel }: {
  href?: string; children: ReactNode; variant?: 'secondary' | 'light'; size?: 'small' | 'large'; onClick?: () => void; ariaLabel?: string;
}) {
  const cls = ['btn', variant, size].filter(Boolean).join(' ');
  if (href) {
    const external = /^https?:/.test(href);
    return (
      <a className={cls} href={href} aria-label={ariaLabel} {...(external ? { target: '_blank', rel: 'noopener' } : {})}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} type="button" onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
