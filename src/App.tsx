import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { Stage } from './scene/Stage';
import { StaticStage } from './scene/StaticStage';
import { WhatItIs, Craft, Specs, Pricing, Faq, FinalCta, Footer } from './components/Sections';
import { Loader } from './components/Loader';
import { useCapabilities } from './hooks/useCapabilities';
import { useProgress } from '@react-three/drei';

export default function App() {
  const caps = useCapabilities();
  // `?static=1` previews the no-WebGL / reduced-motion version of the page.
  const forceStatic = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('static');
  const useStatic = caps.ready && (!caps.webgl || caps.reducedMotion || forceStatic);

  const [modelsReady, setModelsReady] = useState(false);
  const [loaderGone, setLoaderGone] = useState(false);
  const intro = useRef(0);
  const { progress } = useProgress();
  const onLoaded = useCallback(() => setModelsReady(true), []);
  const onHidden = useCallback(() => { setLoaderGone(true); intro.current = performance.now(); }, []);

  useEffect(() => {
    if (!caps.ready || useStatic) return;
    import('./scene/StageCanvas').then((m) => m.preloadModels());
  }, [caps.ready, useStatic]);

  const done = caps.ready && (useStatic || modelsReady);

  return (
    <>
      {!loaderGone && <Loader progress={useStatic ? 100 : progress} done={done} onHidden={onHidden} />}
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        {useStatic ? <StaticStage /> : <Stage caps={caps} onLoaded={onLoaded} intro={intro} />}
        <WhatItIs reduced={caps.reducedMotion} />
        <Craft reduced={caps.reducedMotion} />
        <Specs />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
