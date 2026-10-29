/**
 * Static fallback for browsers without WebGL and for prefers-reduced-motion:
 * the same four scenes as plain sections with the reference renders.
 */
import { hero, scenes, pricing, site } from '../content';
import { Button, Lines } from '../components/ui';

const Img = ({ name, alt, w, h }: { name: string; alt: string; w: number; h: number }) => (
  <picture>
    <source srcSet={`/images/${name}.webp`} type="image/webp" />
    <img src={`/images/${name}.jpg`} alt={alt} width={w} height={h} loading="lazy" decoding="async" />
  </picture>
);

export function StaticStage() {
  return (
    <section aria-label="Product sequence" className="wrap">
      <div className="static-hero">
        <h1 className="h-display">{hero.headline}</h1>
        <p className="lead"><Lines text={hero.sub} /></p>
        <Button href={site.links.preorder}>{hero.cta}</Button>
        <p className="note">{hero.note}</p>
        <Img name="limpet-hero" alt="Limpet aluminium SSD, front view" w={900} h={1600} />
      </div>
      <div className="static-scene" id="how-it-docks">
        <div>
          <h2 className="h-1"><Lines text={scenes.macbook.headline} /></h2>
          <p className="lead">{scenes.macbook.body}</p>
          <p className="detail">{scenes.macbook.detail}</p>
        </div>
        <Img name="macbook-docked" alt="Limpet docked on the lid of a MacBook" w={1800} h={1350} />
      </div>
      <div className="static-scene">
        <div>
          <h2 className="h-1"><Lines text={scenes.iphone.headline} /></h2>
          <p className="lead">{scenes.iphone.body}</p>
          <p className="detail">{scenes.iphone.detail}</p>
        </div>
        <Img name="iphone-docked" alt="Limpet snapped onto the back of an iPhone 16" w={1012} h={1800} />
      </div>
      <div className="static-scene">
        <div>
          <h2 className="h-1"><Lines text={scenes.batch.headline} /></h2>
          <p className="lead">{scenes.batch.body}</p>
          <p className="price-line"><span className="from">From</span><span className="amount">{pricing.currency}{pricing.lite.launchPriceFrom}</span></p>
          <Button href={site.links.preorder}>{scenes.batch.cta}</Button>
        </div>
        <Img name="limpet-front" alt="Limpet, front" w={1800} h={1012} />
      </div>
    </section>
  );
}
