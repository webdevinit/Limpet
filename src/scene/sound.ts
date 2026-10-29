/**
 * Docking sounds, synthesised with Web Audio (no files, no licences, tunable here).
 *
 * Browsers only start audio after a real interaction (click, tap, key press; scrolling with a wheel does not count),
 * so the context is created on the first such gesture. Until then a dock is silent. The visitor's choice
 * (sound on / off) is remembered per browser.
 */

export type Device = 'mac' | 'phone';

const PREF = 'limpet-sound';
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
function click(t: number, freq: number, q: number, dur: number, gain: number, type: BiquadFilterType = 'bandpass') {
  const s = ctx!.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx!.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx!.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master!);
  s.start(t);
  s.stop(t + dur + 0.02);
}

const SYNTHS: Record<Device, (t: number) => void> = {
  // MacBook: the shell lands on the dock plate
  mac: (t) => { tone(t, 150, 62, 0.17, 0.9); tone(t, 310, 130, 0.07, 0.22); click(t, 1800, 1.2, 0.014, 0.2); },
  // iPhone: the magnets catch on the glass back
  // highs only: two high-passed transients a few ms apart (the snap of the magnets), no tonal body, gone within a few ms
  phone: (t) => { click(t, 5500, 0.7, 0.004, 0.75, 'highpass'); click(t + 0.003, 9000, 0.7, 0.003, 0.35, 'highpass'); },
};

/** plays the docking sound for a device (silent until audio is unlocked, or when the visitor turned it off) */
export function playDock(device: Device) {
  if (!enabled || !ctx || !master || ctx.state !== 'running') return;
  SYNTHS[device](ctx.currentTime + 0.005);
}
