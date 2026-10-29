/**
 * Docking sounds, synthesised with Web Audio (no files, no licences, tunable here).
 *
 * Browsers only start audio after a real interaction (click, tap, key press; scrolling with a wheel does not count),
 * so the context is created on the first such gesture. Until then a dock is silent. The visitor's choice
 * (sound on / off) is remembered per browser.
 */

export type Device = 'mac' | 'phone';

/** the variants per device; the first is the default. `?soundlab` on the page lets you audition and pick them. */
export const VARIANTS: Record<Device, { id: string; label: string }[]> = {
  mac: [
    { id: 'blopp', label: 'Blopp: round, low, a soft click on top' },
    { id: 'thunk', label: 'Thunk: deeper and duller' },
    { id: 'knock', label: 'Knock: woody, a little brighter' },
  ],
  phone: [
    { id: 'klack', label: 'Klack: a dry, bright snap, no tail (MagSafe-like)' },
    { id: 'tick', label: 'Tick: small and bright' },
    { id: 'snap', label: 'Snap: a fuller click' },
  ],
};

const PREF = 'limpet-sound';
const VARIANT_PREF = (d: Device) => `limpet-sound-${d}`;
const VOLUME = 0.5;

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage may be blocked */ } };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let enabled = read(PREF) !== 'off';
const listeners = new Set<(on: boolean) => void>();

function ensureContext() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = VOLUME;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

/** call once: unlocks audio on the visitor's first real interaction */
export function installAudioUnlock() {
  const unlock = () => {
    ensureContext();
    if (ctx?.state === 'running') {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('touchend', unlock, true);
    }
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  window.addEventListener('touchend', unlock, true);
}

export const soundEnabled = () => enabled;
export function setSoundEnabled(on: boolean) {
  enabled = on;
  write(PREF, on ? 'on' : 'off');
  if (on) ensureContext();
  listeners.forEach((l) => l(on));
}
export function onSoundChange(l: (on: boolean) => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export const currentVariant = (d: Device) => {
  const v = read(VARIANT_PREF(d));
  return VARIANTS[d].some((x) => x.id === v) ? v! : VARIANTS[d][0].id;
};
export const setVariant = (d: Device, id: string) => write(VARIANT_PREF(d), id);

// ---------------------------------------------------------------- synthesis
/** a pitched blip: frequency glides from f0 to f1, sharp attack, exponential decay */
function tone(t: number, f0: number, f1: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const o = ctx!.createOscillator();
  const g = ctx!.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** a filtered noise burst: the click of metal meeting metal / glass */
function click(t: number, freq: number, q: number, dur: number, gain: number) {
  const s = ctx!.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx!.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx!.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master!);
  s.start(t);
  s.stop(t + dur + 0.02);
}

const SYNTHS: Record<string, (t: number) => void> = {
  // MacBook: the shell lands on the dock plate
  blopp: (t) => { tone(t, 150, 62, 0.17, 0.9); tone(t, 310, 130, 0.07, 0.22); click(t, 1800, 1.2, 0.014, 0.2); },
  thunk: (t) => { tone(t, 112, 52, 0.22, 1.0); click(t, 900, 0.8, 0.022, 0.32); },
  knock: (t) => { tone(t, 230, 175, 0.09, 0.55, 'triangle'); tone(t, 460, 350, 0.05, 0.18); click(t, 3000, 2, 0.009, 0.16); },
  // iPhone: the magnets catch on the glass back
  // two bright transients a few ms apart (the snap of the magnets), only a hint of body, gone within ~20 ms
  klack: (t) => { click(t, 5200, 0.9, 0.006, 0.6); click(t + 0.004, 8000, 1.2, 0.004, 0.28); tone(t, 2300, 1500, 0.014, 0.16); tone(t, 780, 580, 0.016, 0.1); },
  tick: (t) => { click(t, 6000, 2, 0.007, 0.42); tone(t, 920, 700, 0.03, 0.22); },
  snap: (t) => { click(t, 3000, 1, 0.016, 0.5); tone(t, 380, 210, 0.09, 0.5); },
};

/** plays the docking sound for a device (silent until audio is unlocked, or when the visitor turned it off) */
export function playDock(device: Device, variant = currentVariant(device), force = false) {
  if ((!enabled && !force) || !ctx || !master || ctx.state !== 'running') return;
  SYNTHS[variant]?.(ctx.currentTime + 0.005);
}

/** for the sound lab: unlock (the click that calls this is the gesture) and play right away */
export function audition(device: Device, variant: string) { ensureContext(); setTimeout(() => playDock(device, variant, true), 30); }
