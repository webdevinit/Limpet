# Limpet launch site

Scroll-driven product page for the Limpet SSD (Pat Pending). React + Vite + three.js (React Three Fiber).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the build
```

Preview the static (no-WebGL / reduced-motion) version at `http://localhost:5173/?static=1`.

## Where to change things

| What | File |
| --- | --- |
| All copy, prices, capacities, links, FAQ, placeholders | `src/content.ts` |
| Brand tokens (colours, type, radii), layout, overlay positions | `src/styles.css` |
| Scroll choreography (timing, camera, where devices sit; docking constants `SNAP`, `PERCH`, `TILT`, `DOCK_NUDGE`) | `src/scene/choreography.ts` |
| Lighting and material finish | `src/scene/StageCanvas.tsx` (`Studio`, `tuneMaterial`) |
| Static fallback scenes | `src/scene/StaticStage.tsx` |
| Section images (incl. `limpet-configure.png`, the render from patpending.com/configure) / craft video | `public/images/`, `public/video/` (video: `Limpet_Rear_Side_to_Side_4K.mp4` slowed 2.6×, 1280p, ~0.3 MB) |
| Web models | `public/models/` (built by `scripts/build-models.mjs`) |

Anything wrapped in `TBD('…')` in `src/content.ts` renders with a dashed orange outline. Replace the text and remove the wrapper once the fact is confirmed.

### Copy and type

- Copy marked `(existing site)` in `src/content.ts` is taken word for word from patpending.com; everything else is written in the same voice (short lines, plain words, full stops). Keep new copy that short.
- One type scale for the whole page (`src/styles.css`): display headline up to 96 px, section headlines up to 64 px, lead 18 px on a 350 px measure, detail 14 px, notes 13 px. No eyebrows, one button size.
- Header mirrors the existing site: Limpet brand left, Pat Pending face centred, bag + Pre-order right (`src/components/Header.tsx`).
- Hero copy is centred at the top of the stage. The resting Limpet is fitted to the measured copy every frame (`src/scene/StageCanvas.tsx`, `src/scene/heroLayout.ts`): about 80 % as wide as the headline (68 % of the viewport on phones), its top 36 px under the button, the lower part below the first screen's edge; the hero camera distance and height follow from that, so every viewport works. It floats in from below the screen edge after the loader (2.6 s). The MacBook and iPhone scenes keep the copy left, the product right; the final scene is centred at the bottom.

## Models

`npm run build-models` rebuilds `public/models/*.glb` from the handover package
(`Limpet_Website_Handover_2026-10-29/02_GLB`):

- `limpet.glb` (115 KB) — shell, back plate, leather underside, LED, USB plate from `Devices/ssd.glb`, re-based into one canonical frame (metres, Y up, USB tray at +Z).
- `macbook.glb` (1.07 MB) — `Devices/macbook.glb` simplified, plus the laptop dock plate, the cable channel and the fabric cable with its side-port connector from `Sequences/product_sequence.glb`. The cable is a morph animation over the lid angle in the handover; the build bakes the pose for the stage lid angle (`LID_DEG` in `scripts/build-models.mjs`, currently 82°) into a static mesh.
- `iphone.glb` (419 KB) — `Devices/iphone.glb` (CC BY 4.0, Zvoni10 — keep the credit in the footer).

Docking transforms are extracted from the owner's rigs, not hand-placed:

- `src/scene/rig-macbook.json` — Limpet → lid-hinge matrix from the MacBook assemblies.
- `src/scene/rig-iphone.json` — the attach track (93 keys) from `iphone16_attach_detach.glb`, plus port and connector positions.

The iPhone cable is drawn procedurally (`src/scene/Cable.tsx`, 6.5 × 0.8 mm ribbon): a flat cap in the phone's port, a USB-C plug (metal shell, molded boot, strain relief) that the Limpet slides onto, and the ribbon lies flat in the tray up to the tray's open rim before it curves; the baked morph-target cable in the handover is 23 MB and was not used on the web. The leather uses the real grain from the handover render: `public/images/leather-detail.jpg` is a crop of the leather pad in `Limpet_Product_Reference.png` with the lighting gradient removed (high-pass); at runtime `leatherFromImage()` in `src/scene/textures.ts` turns it into albedo, normal and roughness maps (mirrored repeat, 2.17 × 3.3 tiles over the shell). A procedural fallback shows until the image has loaded. The sandblasted-aluminium grain and the fabric weave are small procedural textures; the build adds planar UVs to the Limpet meshes for all of them.

## Scroll sequence (progress 0 → 1 over the 560 vh stage)

| Range | What happens |
| --- | --- |
| 0.00 – 0.18 | Limpet alone: big under the hero copy at rest; as soon as scrolling starts the title fades (0.01–0.07) and the Limpet rises to the centre while the camera pulls back (0.01–0.14), turning ~330° over the range |
| 0.18 – 0.34 | MacBook floats in from the side/depth; Limpet moves above the lid, left of the dock plate |
| 0.34 – 0.47 | Tray end tilts down onto the lid (the dock's USB-C plug threads in), then the other end comes down while the Limpet snaps 12 mm right (LED turns on) |
| 0.52 – 0.72 | Reverse: snaps left, tilts up, lifts 2 cm off the plate; the MacBook backs away (left and into the depth) as soon as the Limpet lets go, the Limpet turns into its iPhone pose right away and travels in a straight line to the waiting cable |
| 0.61 – 0.80 | iPhone (leaning back) comes in from far right and behind; its cable hangs straight down first and swings into the waiting pose; the Limpet follows one curve that ends seated on the connector, arriving along the plug's axis at 90° under the bottom edge, leather up |
| 0.80 – 0.90 | Limpet swings up onto the back and snaps to the MagSafe area (second half of the owner's rig track; seated 3 mm lower and 1 mm off the glass so the flat cable runs under the leather and only shows at the lower edge) |
| 0.92 – 1.00 | iPhone and cable recede and fade; Limpet settles left of centre and a second instance of the shell (leather side to the camera) eases in beside it, slightly overlapping (`PAIR_HALF`); first-batch copy |

Scrolling up plays everything in reverse (the sequence is a pure function of progress).

## Performance / fallbacks

- The stage renders on demand: the scroll handler, the loader (intro start), resizes and resolution changes request frames; the frame loop keeps itself alive only while the intro, the camera damping or the hero fit are still moving. At rest nothing is rendered.
- Adaptive resolution (`src/scene/AdaptiveResolution.tsx`): full device resolution at rest (capped at 4.5 MP), stepped down while moving when frames exceed 17.5 ms (never below 1.1 MP), restored 220 ms after the motion stops.
- `?stats=1` shows fps, frame time, dpr, megapixels, draw calls, triangles and the frame counter over the stage.
- The canvas is opaque (its WebGL context is created in `StageCanvas.tsx` with `alpha: false`, because three r170 always asks for alpha itself) and `src/scene/Backdrop.tsx` draws the stage gradient as one full-screen triangle, so the browser never blends the canvas over the page.
- The model build decimates per part (`MAC_PARTS` in `scripts/build-models.mjs`): the MacBook's bottom shell, connector, solder pads and cable internals are reduced hard, display, hinge and dock face are kept as delivered (MacBook 241 k → 81 k triangles, iPhone 61 k → 38 k at ratio 0.6, Limpet untouched).
- `?nochase=1` makes the sequence jump straight to the scroll position (no capped chase), handy for checking a scene.
- The model build merges sibling meshes that share a material (`join()` in `scripts/build-models.mjs`): MacBook 36 → 20 draw calls, iPhone 97 → 34. It works level by level, so the lid under `MacBook_Display_Hinge` stays a separate subtree and can still be rotated.

- A full-page loader (`src/components/Loader.tsx`: shell mark, Pat Pending face, "Holds on. Like a limpet.", real asset progress, min 2 s) covers the page until the models are decoded; the Limpet then glides in. three.js is a lazy chunk.
- The "Save to Limpet" desktop loop (`src/components/DesktopDemo.tsx`) is plain HTML/CSS — menu items and timing live at the top of that file.
- Canvas only renders while the stage is on screen; device pixel ratio is capped (1.5 on low-power devices).
- Low-power devices (≤4 cores or ≤4 GB) get a smaller environment map.
- No WebGL or `prefers-reduced-motion: reduce` → `StaticStage` (reference renders + the same copy).
- All copy and buttons are real HTML outside the canvas; hidden overlay blocks are `inert`.
