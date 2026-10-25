/**
 * Generates the game's tiny sound effects procedurally (no external assets).
 * Run: node scripts/gen-sounds.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'assets', 'sounds');
mkdirSync(out, { recursive: true });

const RATE = 22050;

function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

function synth(durationSec, fn) {
  const n = Math.floor(RATE * durationSec);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = fn(i / RATE, i / n);
  return s;
}

const env = (p, a = 0.01, r = 0.6) => (p < a ? p / a : Math.pow(1 - (p - a) / (1 - a), r));
let seed = 1;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296 * 2 - 1;
};

const sounds = {
  // short upward blip
  pickup: synth(0.12, (t, p) => Math.sin(2 * Math.PI * (600 + 900 * p) * t) * env(p, 0.02, 1.2) * 0.6),
  // soft thud
  place: synth(0.12, (t, p) => (Math.sin(2 * Math.PI * 180 * t) + noise() * 0.2) * env(p, 0.005, 2) * 0.6),
  // knife hit: noise burst + click
  chop: synth(0.09, (t, p) => (noise() * 0.8 + Math.sin(2 * Math.PI * 900 * t) * 0.4) * env(p, 0.003, 3) * 0.7),
  // sizzling
  sizzle: synth(0.5, (t, p) => noise() * (0.25 + 0.15 * Math.sin(t * 60)) * env(p, 0.05, 0.5) * 0.5),
  // ding (cooking done)
  ding: synth(0.5, (t, p) => (Math.sin(2 * Math.PI * 1320 * t) + 0.5 * Math.sin(2 * Math.PI * 1980 * t)) * env(p, 0.005, 1.5) * 0.5),
  // success arpeggio
  success: synth(0.6, (t, p) => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const idx = Math.min(3, Math.floor(p * 4));
    const f = notes[idx];
    const local = (p * 4) % 1;
    return Math.sin(2 * Math.PI * f * t) * env(local, 0.02, 1) * 0.5;
  }),
  // failure: descending buzz
  fail: synth(0.5, (t, p) => {
    const f = 300 - 150 * p;
    const sq = Math.sign(Math.sin(2 * Math.PI * f * t));
    return (sq * 0.5 + Math.sin(2 * Math.PI * f * 0.5 * t) * 0.5) * env(p, 0.01, 1) * 0.4;
  }),
  // invalid action: short low double-beep
  invalid: synth(0.18, (t, p) => Math.sin(2 * Math.PI * 220 * t) * (p < 0.4 || p > 0.55 ? 1 : 0) * env(p, 0.005, 0.8) * 0.45),
  // countdown tick
  tick: synth(0.08, (t, p) => Math.sin(2 * Math.PI * 880 * t) * env(p, 0.005, 2) * 0.5),
  // go!
  go: synth(0.4, (t, p) => (Math.sin(2 * Math.PI * 660 * t) + Math.sin(2 * Math.PI * 990 * t) * 0.6) * env(p, 0.01, 1.2) * 0.5),
  // new order bell
  bell: synth(0.35, (t, p) => (Math.sin(2 * Math.PI * 1760 * t) + 0.4 * Math.sin(2 * Math.PI * 2640 * t)) * env(p, 0.003, 1.3) * 0.35),
  // footstep
  step: synth(0.05, (t, p) => (noise() * 0.5 + Math.sin(2 * Math.PI * 140 * t)) * env(p, 0.004, 3) * 0.25),
  // match end fanfare
  end: synth(1.2, (t, p) => {
    const notes = [523.25, 523.25, 523.25, 659.25, 783.99, 1046.5];
    const idx = Math.min(5, Math.floor(p * 6));
    const local = (p * 6) % 1;
    return (Math.sin(2 * Math.PI * notes[idx] * t) + 0.3 * Math.sin(2 * Math.PI * notes[idx] * 2 * t)) * env(local, 0.02, 0.8) * 0.45;
  }),
};

for (const [name, samples] of Object.entries(sounds)) {
  writeFileSync(join(out, `${name}.wav`), wav(samples));
}
console.log(`generated ${Object.keys(sounds).length} sounds in ${out}`);
