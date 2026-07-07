// Lightweight Web Audio: synthesized sfx + a procedural music bed
// whose intensity tracks game speed.

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
  private musicNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private musicStarted = false;
  private duckUntil = 0;
  private ambientGain: GainNode | null = null;
  private ambientNoise: AudioBufferSourceNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientOscs: OscillatorNode[] = [];
  private ambientStarted = false;
  public sfxOn = true;
  public musicOn = true;

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
    if (this.musicGain) this.musicGain.gain.value = on ? 0.18 : 0;
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
    if (this.musicStarted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.musicStarted = true;

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 600;
    this.musicFilter.Q.value = 0.7;

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.18 : 0;

    this.musicFilter.connect(this.musicGain).connect(this.master);

    // Pentatonic drone pad — A minor pentatonic
    const notes = [110, 146.83, 164.81, 220, 246.94];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = f;
      g.gain.value = 0.06;
      osc.connect(g).connect(this.musicFilter!);
      osc.start();
      this.musicNodes.push({ osc, gain: g });
    });
  }

  updateMusic(speedPct: number) {
    if (!this.musicFilter || !this.musicGain || !this.ctx) return;
    const target = 500 + speedPct * 3500;
    const now = this.ctx.currentTime;
    const ducked = now < this.duckUntil;
    this.musicFilter.frequency.setTargetAtTime(ducked ? 350 : target, now, 0.4);
    const baseVol = this.musicOn ? 0.18 + speedPct * 0.1 : 0;
    this.musicGain.gain.setTargetAtTime(ducked ? baseVol * 0.35 : baseVol, now, 0.3);
  }
}

export const audio = new AudioEngine();
