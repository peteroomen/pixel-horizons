// ZzFX - Tiny JavaScript Sound FX Engine - v2.0.0 by Frank Force
// https://github.com/KilledByAPixel/ZzFX
// Pasted inline — no npm package, no network request.
// Adapted to TypeScript; AudioContext created lazily per call so SSR is safe.

const SAMPLE_RATE = 44100;

interface GlobalWithWebkit {
  webkitAudioContext?: typeof AudioContext;
}

const getAudioContext = (): AudioContext | null => {
  if (typeof AudioContext !== 'undefined') return new AudioContext();
  const g = globalThis as GlobalWithWebkit;
  if (typeof g.webkitAudioContext !== 'undefined') return new g.webkitAudioContext();
  return null;
};

export function zzfx(
  volume = 1,
  randomness = 0.05,
  frequency = 220,
  attack = 0,
  sustain = 0,
  release = 0.1,
  shape = 0,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _shapeCurve = 1,
  slide = 0,
  deltaSlide = 0,
  pitchJump = 0,
  pitchJumpTime = 0,
  repeatTime = 0,
  noise = 0,
  modulation = 0,
  bitCrush = 0,
  delay = 0,
  sustainVolume = 1,
  decay = 0,
  tremolo = 0,
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const PI2 = Math.PI * 2;
  const sign = (v: number) => (v > 0 ? 1 : -1);
  const random = (v: number) => Math.random() * v * 2 - v;

  // Randomize frequency
  frequency *= 2 ** (random(randomness) * 2);

  const sampleLength = Math.ceil(SAMPLE_RATE * (attack + decay + sustain + release + delay));
  const samples = new Float32Array(sampleLength);

  frequency *= (500 * PI2) / SAMPLE_RATE ** 2;
  slide *= (500 * PI2) / SAMPLE_RATE ** 3;

  if (shape === 3) frequency /= PI2;

  const startFrequency = frequency;
  const startSlide = slide;

  let t = 0;
  let notFirstSample = 0;

  for (let i = 0; i < sampleLength; i++) {
    const e = i / SAMPLE_RATE;

    // Envelope
    let p: number;
    if (e < attack) p = e / attack;
    else if (e < attack + decay) p = 1 - ((e - attack) / decay) * (1 - sustainVolume);
    else if (e < attack + decay + sustain) p = sustainVolume;
    else if (e < attack + decay + sustain + release)
      p = sustainVolume * (1 - (e - attack - decay - sustain) / release);
    else p = 0;

    if (delay) {
      if (e < delay || e > sampleLength / SAMPLE_RATE - delay) {
        p *= Math.sin((PI2 * e) / delay / 4);
      }
    }

    if (tremolo) p *= 1 - tremolo * Math.sin(PI2 * e * tremolo);

    // Update frequency after first sample
    if (notFirstSample++) {
      frequency += slide;
      slide += deltaSlide;

      if (pitchJumpTime && Math.abs(t - pitchJumpTime) < 0.1) {
        frequency += (pitchJump * PI2) / SAMPLE_RATE;
      }

      if (repeatTime && !(i % Math.round(SAMPLE_RATE * repeatTime))) {
        frequency = startFrequency;
        slide = startSlide;
      }
    }

    // Waveform
    let s: number;
    if (shape === 0) s = Math.sin((t += frequency));
    else if (shape === 1) s = sign(Math.sin((t += frequency)));
    else if (shape === 2) s = (((t += frequency) % PI2) / PI2) * 2 - 1;
    else if (shape === 3) s = Math.abs(((t += frequency) % 2) - 1) * 2 - 1;
    else s = Math.tan((t += frequency));

    if (noise) s += random(noise);
    if (bitCrush) s = Math.round(s * 2 ** bitCrush) / 2 ** bitCrush;
    if (modulation) s *= Math.sin((PI2 * i * modulation) / SAMPLE_RATE);

    samples[i] = Math.max(-1, Math.min(1, s * p * volume));
  }

  const buffer = ctx.createBuffer(1, sampleLength, SAMPLE_RATE);
  buffer.copyToChannel(samples, 0);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
  ctx.close();
}
