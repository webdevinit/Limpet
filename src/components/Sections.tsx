import { whatItIs, craft, specs, pricing, faq, finalCta, footer, site } from '../content';
import { Button, Lines, T } from './ui';
import { DesktopDemo } from './DesktopDemo';

/** Copy left, desktop demo right. */
export function WhatItIs({ reduced }: { reduced: boolean }) {
  return (
    <section className="section" id="what">
      <div className="wrap grid-2">
        <div className="copy">
          <h2 className="h-1"><Lines text={whatItIs.headline} /></h2>
          <p className="lead">{whatItIs.body}</p>
        </div>
        <div className="demo-wrap">
          <DesktopDemo reduced={reduced} />
          <p className="demo-caption">{whatItIs.caption}</p>
        </div>
      </div>
    </section>
  );
}

/** Video left, copy right. */
export function Craft({ reduced }: { reduced: boolean }) {
  return (
    <section className="section surface" id="craft">
      <div className="wrap grid-2">
        <div className="media video">
          {reduced ? (
            <img src="/video/macbook-cable-poster.webp" alt="Limpet docked on a closed MacBook, with the fabric cable running to the side port" width={1280} height={720} loading="lazy" />
          ) : (
            <video autoPlay muted loop playsInline preload="metadata" poster="/video/macbook-cable-poster.webp" width={1280} height={720}
              aria-label="Slow camera move around the Limpet docked on a closed MacBook">
              <source src="/video/macbook-cable.mp4" type="video/mp4" />
            </video>
          )}
        </div>
        <div className="copy">
          <h2 className="h-1"><Lines text={craft.headline} /></h2>
          <p className="lead">{craft.body}</p>
          <p className="detail">{craft.detail}</p>
        </div>
      </div>
    </section>
  );
}

/** One centred list. */
export function Specs() {
  return (
    <section className="section" id="specs">
      <div className="wrap centered">
        <h2 className="h-1">{specs.headline}</h2>
        <dl className="spec-list">
          {specs.rows.map((r) => (
            <div className="spec-row" key={r.label}><dt>{r.label}</dt><dd><T v={r.value} /></dd></div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Same build-up as the existing configure teaser: headline, render, two options, delivery line. */
export function Pricing() {
  const plans = [pricing.lite, pricing.pro];
  return (
    <section className="section surface configure" id="pricing">
      <div className="wrap centered">
        <h2 className="h-1">{pricing.headline}</h2>
        <div className="configure-hero">
          <picture>
            <source srcSet="/images/limpet-configure.webp" type="image/webp" />
            <img src="/images/limpet-configure.png" alt="Silver Limpet with its scalloped shell" width={1024} height={1024} loading="lazy" decoding="async" />
          </picture>
        </div>
        <div className="configure-options">
          {plans.map((pl) => (
            <div className="option" key={pl.name}>
              <p className="name">{pl.name}</p>
              <p className="caps">{pl.capacities.join(' · ')}</p>
              <p className="price"><span className="from">From</span><b>{pricing.currency}{pl.launchPriceFrom}</b></p>
              <p className="batch-label">{pricing.batchLabel}</p>
              <Button href={pl.href}>{pl.cta}</Button>
            </div>
          ))}
        </div>
        <p className="note delivery">{pricing.delivery.headline} <T v={pricing.delivery.lead} /></p>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section className="section" id="faq">
      <div className="wrap centered">
        <h2 className="h-1">{faq.headline}</h2>
        <div className="faq">
          {faq.items.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <div className="answer"><T v={item.a} /></div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Dark closing band, as on the existing site. */
export function FinalCta() {
  return (
    <section className="final" id="order">
      <div className="wrap centered">
        <h2 className="h-2">{finalCta.headline}</h2>
        <Button href={site.links.preorder} variant="light">{finalCta.cta}</Button>
        <p className="note"><a href={site.links.waitlist} target="_blank" rel="noopener">{finalCta.waitlist}</a></p>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-top">
          <a className="footer-wordmark" href="/">{site.brand}</a>
          <nav className="footer-pages" aria-label="Footer">
            {footer.pages.map((p) => <a key={p.label} href={p.href}>{p.label}</a>)}
          </nav>
        </div>
        <div className="footer-bottom">
          <span>{footer.legal}</span>
          <span><a href={site.links.instagram}>Instagram</a> · <a href={site.links.linkedin}>LinkedIn</a> · <a href={site.links.x}>X</a></span>
        </div>
      </div>
    </footer>
  );
}
