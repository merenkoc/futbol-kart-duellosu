/**
 * Dosyasız SFX: her efekt kısa bir osilatör + kazanç (attack/decay) zarfıyla
 * Web Audio API üzerinde anlık üretilir. Tarayıcı autoplay kısıtı yüzünden
 * AudioContext ilk kullanıcı etkileşiminde (bir play* çağrısında) oluşturulup
 * resume edilir.
 */
let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

interface Tone {
  freq: number;
  duration: number;
  type?: OscillatorType;
  delay?: number;
  gain?: number;
}

function tone({ freq, duration, type = 'sine', delay = 0, gain = 0.15 }: Tone): void {
  const audio = getContext();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const env = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env);
  env.connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playClick(): void {
  tone({ freq: 720, duration: 0.08, type: 'square', gain: 0.08 });
}

export function playFlip(): void {
  const audio = getContext();
  if (!audio) return;
  const start = audio.currentTime;
  const osc = audio.createOscillator();
  const env = audio.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(300, start);
  osc.frequency.exponentialRampToValueAtTime(700, start + 0.18);
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(0.12, start + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
  osc.connect(env);
  env.connect(audio.destination);
  osc.start(start);
  osc.stop(start + 0.22);
}

export function playWhistle(): void {
  tone({ freq: 1200, duration: 0.3, type: 'sine', gain: 0.1 });
  tone({ freq: 1500, duration: 0.25, type: 'sine', delay: 0.12, gain: 0.09 });
}

export function playGoal(): void {
  [523, 659, 784, 1046].forEach((freq, i) => tone({ freq, duration: 0.25, delay: i * 0.09, gain: 0.12 }));
}

export function playSave(): void {
  tone({ freq: 220, duration: 0.3, type: 'sawtooth', gain: 0.1 });
}

export function playWin(): void {
  [523, 659, 784, 1046, 1318].forEach((freq, i) => tone({ freq, duration: 0.35, delay: i * 0.1, gain: 0.11 }));
}

export function playLose(): void {
  [400, 340, 260].forEach((freq, i) => tone({ freq, duration: 0.4, type: 'sawtooth', delay: i * 0.15, gain: 0.1 }));
}
