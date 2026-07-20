// Lightweight Web Audio: synthesized sfx + a procedural layered music bed
// whose intensity tracks game speed and background theme.

type SfxName =
  | "swap"
  | "coin"
  | "hit"
  | "combo"
  | "milestone"
  | "best"
  | "over"
  | "ui";

export type MusicVibe = "calm" | "tense" | "arcade" | "cinematic" | "dark";

type VibePreset = {
  baseNotes: number[];
  baseTypes: OscillatorType[];
  baseOscGain: number;      // per-oscillator gain inside the base layer
  baseGainBias: number;     // additive lift for the base layer target
  baseGainSpeed: number;    // how much speed pushes the base layer
  pulseNotes: number[];
  pulseType: OscillatorType;
  pulseOscGain: number;
  pulseGainScale: number;   // scales the smoothstep pulse target
  filterBase: number;
  filterRange: number;
  voidMul: number;
};

const VIBE_PRESETS: Record<MusicVibe, VibePreset> = {
  calm: {
    baseNotes: [98, 130.81, 146.83, 196, 220],
    baseTypes: ["sine", "sine", "sine", "triangle", "sine"],
    baseOscGain: 0.16,
    baseGainBias: 0.22,
    baseGainSpeed: 0.10,
    pulseNotes: [261.63, 329.63, 392, 523.25, 587.33],
    pulseType: "sine",
    pulseOscGain: 0.05,
    pulseGainScale: 0.18,
    filterBase: 950,
    filterRange: 2600,
    voidMul: 0.8,
  },
  tense: {
    baseNotes: [110, 138.59, 164.81, 220, 261.63],
    baseTypes: ["triangle", "sawtooth", "triangle", "sawtooth", "triangle"],
    baseOscGain: 0.12,
    baseGainBias: 0.16,
    baseGainSpeed: 0.22,
    pulseNotes: [220, 277.18, 329.63, 415.3, 493.88],
    pulseType: "sawtooth",
    pulseOscGain: 0.05,
    pulseGainScale: 0.38,
    filterBase: 900,
    filterRange: 5200,
    voidMul: 1.1,
  },
  arcade: {
    baseNotes: [110, 146.83, 164.81, 220, 246.94],
    baseTypes: ["sine", "triangle", "sine", "triangle", "sine"],
    baseOscGain: 0.14,
    baseGainBias: 0.18,
    baseGainSpeed: 0.17,
    pulseNotes: [220, 293.66, 329.63, 440, 493.88],
    pulseType: "triangle",
    pulseOscGain: 0.06,
    pulseGainScale: 0.30,
    filterBase: 1200,
    filterRange: 4300,
    voidMul: 1.0,
  },
  cinematic: {
    baseNotes: [82.41, 123.47, 164.81, 246.94, 329.63],
    baseTypes: ["triangle", "sine", "triangle", "sine", "triangle"],
    baseOscGain: 0.17,
    baseGainBias: 0.24,
    baseGainSpeed: 0.16,
    pulseNotes: [329.63, 392, 493.88, 587.33, 659.25],
    pulseType: "triangle",
    pulseOscGain: 0.06,
    pulseGainScale: 0.26,
    filterBase: 1400,
    filterRange: 5000,
    voidMul: 1.05,
  },
  dark: {
    baseNotes: [65.41, 82.41, 98, 130.81, 164.81],
    baseTypes: ["sine", "triangle", "sine", "triangle", "sawtooth"],
    baseOscGain: 0.18,
    baseGainBias: 0.2,
    baseGainSpeed: 0.14,
    pulseNotes: [164.81, 196, 233.08, 293.66, 349.23],
    pulseType: "triangle",
    pulseOscGain: 0.05,
    pulseGainScale: 0.22,
    filterBase: 750,
    filterRange: 3200,
    voidMul: 1.7,
  },
};

const VIBE_STORAGE_KEY = "roperush:musicVibe";
const isVibe = (v: unknown): v is MusicVibe =>
  v === "calm" || v === "tense" || v === "arcade" || v === "cinematic" || v === "dark";

function loadVibe(): MusicVibe {
  if (typeof window === "undefined") return "arcade";
  try {
    const v = window.localStorage.getItem(VIBE_STORAGE_KEY);
    if (isVibe(v)) return v;
  } catch { /* ignore */ }
  return "arcade";
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private baseGain: GainNode | null = null;
  private pulseGain: GainNode | null = null;
  private pulseLFO: OscillatorNode | null = null;
  private pulseLFOGain: GainNode | null = null;
  private voidGain: GainNode | null = null;
  private voidFilter: BiquadFilterNode | null = null;
  private baseNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private pulseNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private voidNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private musicStarted = false;
  private duckUntil = 0;
  private ambientGain: GainNode | null = null;
  private ambientNoise: AudioBufferSourceNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientOscs: OscillatorNode[] = [];
  private ambientStarted = false;
  public sfxOn = true;
  public musicOn = true;
  private vibe: MusicVibe = loadVibe();

  get muted() { return !this.sfxOn && !this.musicOn; }
  setMuted(on: boolean) {
    this.setSfx(!on);
    this.setMusic(!on);
  }

  getVibe(): MusicVibe { return this.vibe; }
  setVibe(vibe: MusicVibe) {
    if (!isVibe(vibe)) return;
    this.vibe = vibe;
    try { window.localStorage.setItem(VIBE_STORAGE_KEY, vibe); } catch { /* ignore */ }
    this.applyVibeToNodes();
    // Force next updateMusicLayers to re-apply targets under the new preset.
    this.lastFilter = -1;
    this.lastBase = -1;
    this.lastPulse = -1;
    this.lastVoid = -1;
    this.lastVoidFilter = -1;
  }

  private applyVibeToNodes() {
    if (!this.ctx) return;
    const preset = VIBE_PRESETS[this.vibe];
    const t = this.ctx.currentTime;
    this.baseNodes.forEach((n, i) => {
      const f = preset.baseNotes[i] ?? preset.baseNotes[preset.baseNotes.length - 1];
      n.osc.type = preset.baseTypes[i] ?? preset.baseTypes[0];
      n.osc.frequency.setTargetAtTime(f, t, 0.15);
      n.gain.gain.setTargetAtTime(preset.baseOscGain, t, 0.2);
    });
    this.pulseNodes.forEach((n, i) => {
      const f = preset.pulseNotes[i] ?? preset.pulseNotes[preset.pulseNotes.length - 1];
      n.osc.type = preset.pulseType;
      n.osc.frequency.setTargetAtTime(f, t, 0.15);
      n.gain.gain.setTargetAtTime(preset.pulseOscGain, t, 0.2);
    });
  }

  private ensure() {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  resume() {
    const ctx = this.ensure();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  setSfx(on: boolean) { this.sfxOn = on; }
  setMusic(on: boolean) {
    this.musicOn = on;
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(on ? 1 : 0, t, 0.1);
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol = 0.2, slide = 0) {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  sfx(name: SfxName) {
    switch (name) {
      case "swap": this.blip(520, 0.07, "triangle", 0.12, -180); break;
      case "coin": this.blip(1180, 0.07, "square", 0.1); this.blip(1760, 0.09, "square", 0.08); break;
      case "hit":
        this.blip(160, 0.18, "sawtooth", 0.28, -100);
        this.blip(80, 0.22, "square", 0.2, -40);
        if (this.ctx && this.musicGain) {
          const t = this.ctx.currentTime;
          this.duckUntil = t + 1.0;
          this.musicGain.gain.cancelScheduledValues(t);
          this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
          this.musicGain.gain.linearRampToValueAtTime(0.35, t + 0.05);
          this.musicGain.gain.linearRampToValueAtTime(this.musicOn ? 1 : 0, t + 1.0);
        }
        break;
      case "combo": this.blip(880, 0.06, "triangle", 0.1, 240); break;
      case "milestone":
        this.blip(660, 0.1, "triangle", 0.18, 220);
        this.blip(990, 0.16, "triangle", 0.18, 220);
        break;
      case "best":
        [660, 880, 1180].forEach((f, i) => setTimeout(() => this.blip(f, 0.15, "triangle", 0.2), i * 80));
        break;
      case "over": this.blip(220, 0.4, "sawtooth", 0.22, -120); break;
      case "ui": this.blip(440, 0.05, "square", 0.08); break;
    }
  }

  startMusic() {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (ctx.state === "suspended") { void ctx.resume(); }

    if (this.musicStarted) {
      if (this.musicGain) {
        const t0 = ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(t0);
        this.musicGain.gain.setValueAtTime(this.musicOn ? 1 : 0, t0);
      }
      if (this.baseGain) {
        const t0 = ctx.currentTime;
        this.baseGain.gain.cancelScheduledValues(t0);
        this.baseGain.gain.setValueAtTime(0.2, t0);
      }
      return;
    }
    this.musicStarted = true;

    const preset = VIBE_PRESETS[this.vibe];

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = preset.filterBase;
    this.musicFilter.Q.value = 0.7;

    this.musicGain = ctx.createGain();
    const tStart = ctx.currentTime;
    this.musicGain.gain.setValueAtTime(this.musicOn ? 1 : 0, tStart);
    this.musicFilter.connect(this.musicGain).connect(this.master);

    // 1. Base pad
    this.baseGain = ctx.createGain();
    this.baseGain.gain.setValueAtTime(preset.baseGainBias, tStart);
    this.baseGain.connect(this.musicFilter);
    preset.baseNotes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = preset.baseTypes[i] ?? preset.baseTypes[0];
      osc.frequency.value = f;
      g.gain.value = preset.baseOscGain;
      osc.connect(g).connect(this.baseGain!);
      osc.start();
      this.baseNodes.push({ osc, gain: g });
    });

    // 2. Pulse layer
    this.pulseGain = ctx.createGain();
    this.pulseGain.gain.setValueAtTime(0, tStart);
    this.pulseGain.connect(this.musicFilter);
    preset.pulseNotes.forEach((f) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = preset.pulseType;
      osc.frequency.value = f;
      g.gain.value = preset.pulseOscGain;
      osc.connect(g).connect(this.pulseGain!);
      osc.start();
      this.pulseNodes.push({ osc, gain: g });
    });

    // 3. Void layer
    this.voidFilter = ctx.createBiquadFilter();
    this.voidFilter.type = "lowpass";
    this.voidFilter.frequency.value = 450;
    this.voidFilter.Q.value = 0.6;
    this.voidGain = ctx.createGain();
    this.voidGain.gain.setValueAtTime(0, tStart);
    this.voidGain.connect(this.voidFilter).connect(this.musicFilter);
    const voidNotes = [55, 65.4, 82.5];
    voidNotes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = f;
      g.gain.value = 0.22;
      osc.connect(g).connect(this.voidGain!);
      osc.start();
      this.voidNodes.push({ osc, gain: g });
    });
  }

  private lastFilter = -1;
  private lastBase = -1;
  private lastPulse = -1;
  private lastVoid = -1;
  private lastVoidFilter = -1;
  private musicT0 = -1;

  updateMusicLayers(speedPct: number, themeDarkness: number, voidAmt: number) {
    if (!this.ctx || !this.musicFilter || !this.musicGain) return;
    const preset = VIBE_PRESETS[this.vibe];
    const now = this.ctx.currentTime;
    if (this.musicT0 < 0) this.musicT0 = now;
    const elapsed = now - this.musicT0;
    const ducked = now < this.duckUntil;
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const changed = (prev: number, next: number, rel = 0.015) =>
      prev < 0 || Math.abs(next - prev) > Math.max(0.001, Math.abs(prev) * rel);

    const s = clamp01(speedPct);
    const sCurve = s * s * (3 - 2 * s);
    const sSlow = sCurve * (0.4 + 0.6 * s);

    const modA = Math.sin((2 * Math.PI * elapsed) / 23);
    const modB = Math.sin((2 * Math.PI * elapsed) / 37);
    const filterMod = modA * 350;
    const pulseMod = modB * 0.05;
    const baseMod = modA * 0.02;

    const targetFilter = clamp(preset.filterBase + sCurve * preset.filterRange + filterMod, 400, 7000);
    const filterVal = ducked ? Math.min(preset.filterBase, 700) : targetFilter;
    if (changed(this.lastFilter, filterVal)) {
      this.musicFilter.frequency.setTargetAtTime(filterVal, now, 0.6);
      this.lastFilter = filterVal;
    }

    const baseVol = clamp01(preset.baseGainBias + sCurve * preset.baseGainSpeed + sCurve * baseMod);
    const baseVal = ducked ? baseVol * 0.35 : baseVol;
    if (this.baseGain && changed(this.lastBase, baseVal)) {
      this.baseGain.gain.setTargetAtTime(baseVal, now, 0.6);
      this.lastBase = baseVal;
    }

    const pulseVol = clamp01(sSlow * preset.pulseGainScale + sCurve * pulseMod);
    const pulseVal = ducked ? pulseVol * 0.35 : pulseVol;
    if (this.pulseGain && changed(this.lastPulse, pulseVal)) {
      this.pulseGain.gain.setTargetAtTime(pulseVal, now, 0.7);
      this.lastPulse = pulseVal;
    }

    const voidAmount = Math.max(voidAmt, themeDarkness * 0.55);
    const voidVol = clamp01(voidAmount * preset.voidMul) * 0.10;
    const voidVal = ducked ? voidVol * 0.35 : voidVol;
    if (this.voidGain && changed(this.lastVoid, voidVal)) {
      this.voidGain.gain.setTargetAtTime(voidVal, now, 0.5);
      this.lastVoid = voidVal;
    }
    const voidFilterVal = 450 - voidAmount * 200;
    if (this.voidFilter && changed(this.lastVoidFilter, voidFilterVal)) {
      this.voidFilter.frequency.setTargetAtTime(voidFilterVal, now, 0.5);
      this.lastVoidFilter = voidFilterVal;
    }
  }


  private startAmbient() {
    if (this.ambientStarted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.ambientStarted = true;

    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 700;
    filt.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    src.connect(filt).connect(gain).connect(this.master);
    src.start();

    const droneFreqs = [55, 82.5, 65.4];
    droneFreqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = f;
      g.gain.value = 0.25;
      osc.connect(g).connect(gain);
      osc.start();
      this.ambientOscs.push(osc);
    });

    this.ambientNoise = src;
    this.ambientFilter = filt;
    this.ambientGain = gain;
  }

  updateAmbient(voidAmt: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (voidAmt > 0.01 && !this.ambientStarted) this.startAmbient();
    if (!this.ambientGain) return;
    const amt = Math.max(0, Math.min(1, voidAmt));
    const target = amt * 0.12;
    this.ambientGain.gain.setTargetAtTime(target, ctx.currentTime, 0.6);
  }
}

export const audio = new AudioEngine();
