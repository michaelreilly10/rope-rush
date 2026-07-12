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

  get muted() { return !this.sfxOn && !this.musicOn; }
  setMuted(on: boolean) {
    this.setSfx(!on);
    this.setMusic(!on);
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
        this.duckUntil = (this.ctx?.currentTime ?? 0) + 1.0;
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
    // On repeat runs, just re-trigger the fade-in on the existing graph
    if (this.musicStarted) {
      if (this.musicGain && this.musicOn) {
        const t0 = ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(t0);
        this.musicGain.gain.setValueAtTime(0, t0);
        this.musicGain.gain.linearRampToValueAtTime(1, t0 + 3.0);
      }
      return;
    }
    this.musicStarted = true;


    // Master music fader and shared filter
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 600;
    this.musicFilter.Q.value = 0.7;

    this.musicGain = ctx.createGain();
    // Fade in gently from silence so the music eases in at the start of a run
    this.musicGain.gain.value = 0;
    if (this.musicOn) {
      const t0 = ctx.currentTime;
      this.musicGain.gain.setValueAtTime(0, t0);
      this.musicGain.gain.linearRampToValueAtTime(1, t0 + 3.0);
    }
    this.musicFilter.connect(this.musicGain).connect(this.master);


    // 1. Base pad — deep pentatonic drone, always present
    this.baseGain = ctx.createGain();
    this.baseGain.gain.value = 0;
    this.baseGain.connect(this.musicFilter);
    const baseNotes = [110, 146.83, 164.81, 220, 246.94];
    baseNotes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = f;
      g.gain.value = 0.05;
      osc.connect(g).connect(this.baseGain!);
      osc.start();
      this.baseNodes.push({ osc, gain: g });
    });

    // 2. Pulse layer — smooth harmonic swell that fades in with speed (no tremolo)
    this.pulseGain = ctx.createGain();
    this.pulseGain.gain.value = 0;
    this.pulseGain.connect(this.musicFilter);
    const pulseNotes = [220, 293.66, 329.63, 440, 493.88];
    pulseNotes.forEach((f) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      g.gain.value = 0.028;
      osc.connect(g).connect(this.pulseGain!);
      osc.start();
      this.pulseNodes.push({ osc, gain: g });
    });


    // 3. Void layer — dark sub drones, rises in the void / dark themes
    this.voidFilter = ctx.createBiquadFilter();
    this.voidFilter.type = "lowpass";
    this.voidFilter.frequency.value = 450;
    this.voidFilter.Q.value = 0.6;
    this.voidGain = ctx.createGain();
    this.voidGain.gain.value = 0;
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

  updateMusicLayers(speedPct: number, themeDarkness: number, voidAmt: number) {
    if (!this.ctx || !this.musicFilter || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const ducked = now < this.duckUntil;
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

    const s = clamp01(speedPct);
    // Gentle quartic curve: very calm early, most intensity near max speed
    const easeSlow = s * s * s * s;
    const easeMid = s * s * s;

    // Shared filter: stays dark and mellow at low speed, opens dramatically near max
    const targetFilter = 340 + easeMid * 4400;
    this.musicFilter.frequency.setTargetAtTime(ducked ? 300 : targetFilter, now, 0.8);

    // Base pad: soft at start, gradual lift
    const baseVol = 0.05 + easeMid * 0.1;
    this.baseGain?.gain.setTargetAtTime(ducked ? baseVol * 0.35 : baseVol, now, 0.8);

    // Pulse layer: silent for the opening, blooms only in the upper speed range
    const pulseVol = easeSlow * 0.14;
    this.pulseGain?.gain.setTargetAtTime(ducked ? pulseVol * 0.35 : pulseVol, now, 0.9);


    // Void layer: rises with void amount and theme darkness
    const voidAmount = Math.max(voidAmt, themeDarkness * 0.55);
    const voidVol = clamp01(voidAmount) * 0.18;
    this.voidGain?.gain.setTargetAtTime(ducked ? voidVol * 0.35 : voidVol, now, 0.5);
    // Darken the void filter as it gets deeper
    if (this.voidFilter) this.voidFilter.frequency.setTargetAtTime(450 - voidAmount * 200, now, 0.5);

    // Master fader respects the music toggle
    const masterVol = this.musicOn ? 1 : 0;
    this.musicGain.gain.setTargetAtTime(ducked ? masterVol * 0.35 : masterVol, now, 0.3);
  }

  private startAmbient() {
    if (this.ambientStarted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.ambientStarted = true;

    // Pink-ish noise buffer (2s loop)
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

    // Deep sub drones for atmosphere
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
    const target = amt * 0.22;
    this.ambientGain.gain.setTargetAtTime(target, ctx.currentTime, 0.6);
  }
}

export const audio = new AudioEngine();
