// Lightweight Web Audio: synthesized sfx + a single catchy melodic loop
// whose tempo and energy scale with the player's current falling speed.

type SfxName =
  | "swap"
  | "coin"
  | "hit"
  | "combo"
  | "milestone"
  | "best"
  | "over"
  | "ui";

// Kept for backwards compat with any imports; music is a single tune now.
export type MusicVibe = "arcade";

// A 16-step atmospheric A-minor loop. `null` = rest.
// Smaller interval jumps, lower/mid register, and sustained notes keep it from
// sounding toy-like or circus-like.
const LEAD_NOTES: (number | null)[] = [
  220.00, 261.63, 329.63, 392.00,
  349.23, 329.63, 293.66, 261.63,
  220.00, 261.63, 220.00, 196.00,
  220.00, 196.00, 164.81, 196.00,
];
const BASS_NOTES: (number | null)[] = [
  110.00, null, 82.41, null,
  110.00, null, 82.41, null,
  73.42, null, 110.00, null,
  82.41, null, 110.00, null,
];
const STEPS = LEAD_NOTES.length;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private leadGain: GainNode | null = null;
  private bassGain: GainNode | null = null;
  private voidGain: GainNode | null = null;
  private voidFilter: BiquadFilterNode | null = null;
  private voidNodes: OscillatorNode[] = [];
  private musicStarted = false;
  private duckUntil = 0;
  private ambientGain: GainNode | null = null;
  private ambientNoise: AudioBufferSourceNode | null = null;
  private ambientOscs: OscillatorNode[] = [];
  private ambientStarted = false;
  public sfxOn = true;
  public musicOn = true;

  // Sequencer state
  private nextStepTime = 0;
  private stepIndex = 0;
  private currentSpeedPct = 0;
  private schedulerId: ReturnType<typeof setInterval> | null = null;

  get muted() { return !this.sfxOn && !this.musicOn; }
  setMuted(on: boolean) {
    this.setSfx(!on);
    this.setMusic(!on);
  }

  // No-op setters kept for API compatibility with the old vibe picker.
  getVibe(): MusicVibe { return "arcade"; }
  setVibe(_v: MusicVibe) { /* single-tune build */ }

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
      // Restart sequencer cleanly for a new run.
      this.stepIndex = 0;
      this.nextStepTime = ctx.currentTime + 0.05;
      return;
    }
    this.musicStarted = true;

    const tStart = ctx.currentTime;

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 1400;
    this.musicFilter.Q.value = 0.6;

    this.musicGain = ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.musicOn ? 1 : 0, tStart);
    this.musicFilter.connect(this.musicGain).connect(this.master);

    this.leadGain = ctx.createGain();
    this.leadGain.gain.value = 0.22;
    this.leadGain.connect(this.musicFilter);

    this.bassGain = ctx.createGain();
    this.bassGain.gain.value = 0.28;
    this.bassGain.connect(this.musicFilter);

    // Void layer (for space theme) — a low drone gated by voidAmt.
    this.voidFilter = ctx.createBiquadFilter();
    this.voidFilter.type = "lowpass";
    this.voidFilter.frequency.value = 450;
    this.voidFilter.Q.value = 0.6;
    this.voidGain = ctx.createGain();
    this.voidGain.gain.setValueAtTime(0, tStart);
    this.voidGain.connect(this.voidFilter).connect(this.musicFilter);
    [55, 65.4, 82.5].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = f;
      g.gain.value = 0.22;
      osc.connect(g).connect(this.voidGain!);
      osc.start();
      this.voidNodes.push(osc);
    });

    // Start the note scheduler.
    this.stepIndex = 0;
    this.nextStepTime = tStart + 0.05;
    if (this.schedulerId == null) {
      this.schedulerId = setInterval(() => this.scheduleAhead(), 40);
    }
  }

  private stepDuration(): number {
    // Tempo ramps from 60 BPM (calm) to 108 BPM (max speed).
    const s = Math.max(0, Math.min(1, this.currentSpeedPct));
    const eased = s * s * (3 - 2 * s);
    const bpm = 60 + eased * 48;
    // 16th-note grid: 4 steps per beat.
    return 60 / bpm / 4;
  }

  private scheduleAhead() {
    if (!this.ctx || !this.leadGain || !this.bassGain) return;
    const now = this.ctx.currentTime;
    const lookahead = 0.15;
    while (this.nextStepTime < now + lookahead) {
      this.playStep(this.stepIndex, this.nextStepTime);
      this.nextStepTime += this.stepDuration();
      this.stepIndex = (this.stepIndex + 1) % STEPS;
    }
  }

  private playStep(i: number, when: number) {
    const ctx = this.ctx!;
    const s = Math.max(0, Math.min(1, this.currentSpeedPct));
    const energy = 0.5 + 0.5 * s; // scales note volume with speed

    const lead = LEAD_NOTES[i];
    if (lead != null && this.leadGain) {
      // Warmer lead: triangle plus a subtle detuned sine body.
      // Small portamento from the previous note so the line flows rather than jumps.
      const slideFrom = this.lastLeadFreq;
      this.lastLeadFreq = lead;
      this.noteOn(lead, when, this.stepDuration() * 1.7, "triangle", 0.14 * energy, this.leadGain, slideFrom, 0.05);
      this.noteOn(lead, when, this.stepDuration() * 1.7, "sine", 0.06 * energy, this.leadGain, slideFrom, 0.05, -7);
    } else if (lead == null) {
      this.lastLeadFreq = null;
    }
    const bass = BASS_NOTES[i];
    if (bass != null && this.bassGain) {
      // Triangle bass is smoother and less buzzy than sawtooth.
      this.noteOn(bass, when, this.stepDuration() * 2.0, "triangle", 0.18 + 0.07 * s, this.bassGain);
    }
  }

  private noteOn(
    freq: number,
    when: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    dest: AudioNode,
    slideFrom?: number | null,
    slideTime?: number,
    detuneCents: number = 0,
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.detune.value = detuneCents;
    const startFreq = slideFrom ?? freq;
    osc.frequency.setValueAtTime(startFreq, when);
    if (slideFrom != null && slideFrom !== freq && slideTime) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq), when + slideTime);
    }
    // Softer attack so notes don’t snap on; smoother release.
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.04);
    g.gain.setValueAtTime(vol, when + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g).connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  private lastFilter = -1;
  private lastVoid = -1;
  private lastVoidFilter = -1;
  private lastLeadFreq: number | null = null;

  updateMusicLayers(speedPct: number, themeDarkness: number, voidAmt: number) {
    if (!this.ctx || !this.musicFilter || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const ducked = now < this.duckUntil;
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const s = clamp01(speedPct);
    this.currentSpeedPct = s;

    // Open filter as speed rises to add brightness/energy.
    const targetFilter = 1200 + s * 4200;
    const filterVal = ducked ? 900 : targetFilter;
    if (Math.abs(filterVal - this.lastFilter) > 40) {
      this.musicFilter.frequency.setTargetAtTime(filterVal, now, 0.4);
      this.lastFilter = filterVal;
    }

    const voidAmount = Math.max(voidAmt, themeDarkness * 0.55);
    const voidVol = clamp01(voidAmount) * 0.08;
    const voidVal = ducked ? voidVol * 0.35 : voidVol;
    if (this.voidGain && Math.abs(voidVal - this.lastVoid) > 0.005) {
      this.voidGain.gain.setTargetAtTime(voidVal, now, 0.5);
      this.lastVoid = voidVal;
    }
    const voidFilterVal = 450 - voidAmount * 200;
    if (this.voidFilter && Math.abs(voidFilterVal - this.lastVoidFilter) > 10) {
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

    [55, 82.5, 65.4].forEach((f, i) => {
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
