/**
 * Where the hero copy ends on screen. The canvas fits the resting Limpet to these numbers:
 * about 80 % as wide as the headline, its top just under the button, the rest below the screen edge.
 */
export type HeroLayout = {
  /** bottom edge of the hero copy block, in stage px (0 = not measured yet) */
  bottom: number;
  /** rendered width of the headline text, px */
  width: number;
  /** the stage's offset from the page top (the header's height), px */
  stageTop: number;
};

export const emptyHeroLayout = (): HeroLayout => ({ bottom: 0, width: 0, stageTop: 0 });

export function measureHeroLayout(track: HTMLElement, copy: HTMLElement): HeroLayout {
  const h1 = copy.querySelector('h1');
  let width = copy.offsetWidth;
  if (h1) {
    const range = document.createRange();
    range.selectNodeContents(h1);
    width = range.getBoundingClientRect().width || h1.offsetWidth;
  }
  return { bottom: copy.offsetTop + copy.offsetHeight, width, stageTop: track.offsetTop };
}
