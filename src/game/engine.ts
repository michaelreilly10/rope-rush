import { audio } from "./audio";
import { findChar, findRope, findTrail } from "./cosmetics";
import { loadSave, saveSave, type SaveData } from "./storage";
import type {
  Coin,
  GamePhase,
  HUDState,
  Obstacle,
  ObstacleKind,
  Particle,
  Side,
  ThemePalette,
} from "./types";

// World units are meters of descent. The camera is fixed; everything
// scrolls upward as `worldY` increases.

const MAX_OBSTACLES = 32;
const MAX_COINS = 48;
const MAX_PARTICLES = 160;

const BASE_SPEED = 6; // m/s
const MAX_SPEED = 28;
const SPEED_ACCEL = 0.18; // per second

const INK = "#0d0a08";

// First 3 are the fixed intro cycle: day -> sunset -> night.
// Index 3 is the "black" bridge. Everything from index 4 onward is an
// exotic color palette shuffled through without repeats during a run.
const THEMES: ThemePalette[] = [
  {
    id: "day",
    name: "Bright Day",
    bg: "#7fc7ff",
    bgFar: "#b7e5ff",
    bgNear: "#7bc450",
    beam: "#3f7a24",
    accent: "#ff5d3a",
    lantern: "#ffd23f",
    celestial: "sun",
    night: 0,
  },
  {
    id: "sunset",
    name: "Sunset",
    bg: "#ffb26a",
    bgFar: "#ff7a4a",
    bgNear: "#6a2a5a",
    beam: "#3a1226",
    accent: "#ff4a6a",
    lantern: "#ffd06a",
    celestial: "sun",
    night: 0.15,
  },
  {
    id: "night",
    name: "Night",
    bg: "#141833",
    bgFar: "#0a0d24",
    bgNear: "#0e1a14",
    beam: "#08120a",
    accent: "#6b8afe",
    lantern: "#f4f0d0",
    celestial: "moon",
    night: 1,
  },
  {
    id: "void",
    name: "Void",
    bg: "#050507",
    bgFar: "#020204",
    bgNear: "#08080c",
    beam: "#000000",
    accent: "#4a4a66",
    lantern: "#cfcfe0",
    celestial: "none",
    night: 0.85,
  },
  {
    id: "amethyst",
    name: "Amethyst",
    bg: "#4a1f7a",
    bgFar: "#2a1050",
    bgNear: "#1a0838",
    beam: "#12042a",
    accent: "#ff7ad9",
    lantern: "#e9b8ff",
    celestial: "moon",
    night: 0.7,
  },
  {
    id: "cobalt",
    name: "Cobalt",
    bg: "#1f3fa8",
    bgFar: "#0f2270",
    bgNear: "#08154a",
    beam: "#020a2a",
    accent: "#5ed0ff",
    lantern: "#b8dcff",
    celestial: "moon",
    night: 0.5,
  },
  {
    id: "crimson",
    name: "Crimson",
    bg: "#9a1a2c",
    bgFar: "#5a0810",
    bgNear: "#2a0208",
    beam: "#160204",
    accent: "#ffb45e",
    lantern: "#ffd6a8",
    celestial: "sun",
    night: 0.35,
  },
  {
    id: "teal",
    name: "Abyss Teal",
    bg: "#0f5a5e",
    bgFar: "#053032",
    bgNear: "#02181a",
    beam: "#010c0e",
    accent: "#5effd0",
    lantern: "#b8fff0",
    celestial: "moon",
    night: 0.55,
  },
  {
    id: "magenta",
    name: "Neon Magenta",
    bg: "#a0148c",
    bgFar: "#600a58",
    bgNear: "#2a0428",
    beam: "#14001a",
    accent: "#5ef0ff",
    lantern: "#ffb8f0",
    celestial: "none",
    night: 0.6,
  },
  {
    id: "emerald",
    name: "Emerald",
    bg: "#0f6a3a",
    bgFar: "#053a1e",
    bgNear: "#021a0c",
    beam: "#010c06",
    accent: "#ffe45e",
    lantern: "#c8ffb8",
    celestial: "moon",
    night: 0.4,
  },
  {
    id: "amber",
    name: "Amber",
    bg: "#c47a12",
    bgFar: "#7a4408",
    bgNear: "#3a1e02",
    beam: "#180c00",
    accent: "#ff3a5e",
    lantern: "#ffe0a0",
    celestial: "sun",
    night: 0.1,
  },
  {
    id: "ice",
    name: "Ice",
    bg: "#7ec8e3",
    bgFar: "#c8ecf5",
    bgNear: "#e8f6fb",
    beam: "#4a7a90",
    accent: "#5e6aff",
    lantern: "#ffffff",
    celestial: "sun",
    night: 0,
  },
  {
    id: "indigo",
    name: "Indigo Cosmos",
    bg: "#1a1050",
    bgFar: "#0a0630",
    bgNear: "#050218",
    beam: "#020110",
    accent: "#ff5eb8",
    lantern: "#c8b8ff",
    celestial: "moon",
    night: 0.95,
  },
  {
    id: "rose",
    name: "Rose Dawn",
    bg: "#ff8fa8",
    bgFar: "#ffc8c0",
    bgNear: "#ff5e8a",
    beam: "#7a1a3a",
    accent: "#5efff0",
    lantern: "#fff0d0",
    celestial: "sun",
    night: 0.05,
  },
];

const FIXED_INTRO_COUNT = 4; // day, sunset, night, void


function resetPct(score: number) {
  if (score < 200) return 0.3;
  if (score < 500) return 0.4;
  if (score < 1000) return 0.5;
  return 0.6;
}

const ARROW_WARN = 0.75; // seconds warning shows at bottom
const ARROW_FLY = 0.32; // seconds arrow takes to rise across screen
const ARROW_TOTAL = ARROW_WARN + ARROW_FLY;

function bandKinds(score: number): ObstacleKind[] {
  if (score < 300) return ["spike"];
  if (score < 600) return ["spike", "blade"];
  if (score < 1200) return ["spike", "blade", "arrow"];
  return ["spike", "spike", "blade", "blade", "arrow"];
}

function bandSpawnGap(score: number, speed: number): number {
  // Vertical meters between obstacles. Tighter as score grows, but always
  // scaled so the player has time to react at any speed.
  const reactionWindow = 0.9; // seconds player gets at minimum
  const minBySpeed = speed * reactionWindow;
  const base = score < 300 ? 8 : score < 800 ? 6.5 : score < 1500 ? 5.5 : score < 2500 ? 5 : 4.5;
  return Math.max(minBySpeed, base);
}

interface Listener {
  (s: HUDState): void;
}

export class Game {
  // canvas
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private dpr = 1;
  private W = 360;
  private H = 720;

  // run state
  phase: GamePhase = "menu";
  worldY = 0; // meters descended (also = score)
  speed = BASE_SPEED;
  lives = 3;
  coinsRun = 0;
  combo = 0;
  invulnUntil = 0;
  hitFlash = 0;
  shake = 0;
  ninjaSide: Side = -1;
  ninjaSpin = 0; // 0..1 spin animation timer
  spinDir = 1;
  nextSpawnY = 18;
  nextCoinY = 12;
  themeIndex = 0;
  themeT = 0; // crossfade 0..1
  prevThemeIndex = 0;
  private themeBandIndex = 0; // last consumed band integer
  private themeQueue: number[] = []; // shuffled exotic-theme indices
  canContinue = true; // one ad continue per run

  // pools
  obstacles: Obstacle[] = [];
  coins: Coin[] = [];
  particles: Particle[] = [];
  cloudLayers: { y: number; x: number; s: number; shape: number }[][] = [[], [], []];

  // timing
  private lastT = 0;
  private rafId = 0;
  private running = false;

  // save
  save: SaveData = loadSave();

  // listeners
  private listeners = new Set<Listener>();

  constructor() {
    for (let i = 0; i < MAX_OBSTACLES; i++) {
      this.obstacles.push({ active: false, kind: "spike", y: 0, side: 0, phase: 0, passed: false, hit: false });
    }
    for (let i = 0; i < MAX_COINS; i++) {
      this.coins.push({ active: false, y: 0, side: -1, collected: false, spin: 0 });
    }
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: "#fff", size: 2, kind: "smoke" });
    }
  }

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    this.resize();
    this.initClouds();
    audio.setSfx(this.save.settings.sfx);
    audio.setMusic(this.save.settings.music);
    this.start();
  }

  detach() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    l(this.snapshot());
    return () => { this.listeners.delete(l); };
  }

  private emit() {
    const s = this.snapshot();
    this.listeners.forEach((l) => l(s));
  }

  private snapshot(): HUDState {
    return {
      score: Math.floor(this.worldY),
      best: this.save.best,
      coins: this.save.coins,
      runCoins: this.coinsRun,
      lives: this.lives,
      combo: this.combo,
      comboFlash: this.comboFlashLabel,
      shield: false,
      goldenRope: false,
      slowMo: false,
      speedPct: (this.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED),
      themeName: THEMES[this.themeIndex].name,
      phase: this.phase,
      canContinue: this.canContinue,
    };
  }

  private comboFlashLabel: string | null = null;
  private comboFlashUntil = 0;
  private flashCombo(label: string) {
    this.comboFlashLabel = label;
    this.comboFlashUntil = performance.now() + 1200;
    this.emit();
  }

  // ---------- run control ----------

  startRun() {
    this.phase = "playing";
    this.worldY = 0;
    this.speed = BASE_SPEED;
    this.lives = 3;
    this.coinsRun = 0;
    this.combo = 0;
    this.invulnUntil = 0;
    this.hitFlash = 0;
    this.shake = 0;
    this.ninjaSide = -1;
    this.ninjaSpin = 0;
    this.nextSpawnY = 18;
    this.nextCoinY = 12;
    this.themeIndex = 0;
    this.prevThemeIndex = 0;
    this.themeT = 1;
    this.themeBandIndex = 0;
    this.themeQueue = [];
    this.initClouds();
    this.canContinue = true;
    this.obstacles.forEach((o) => (o.active = false));
    this.coins.forEach((c) => (c.active = false));
    this.particles.forEach((p) => (p.active = false));
    audio.resume();
    audio.startMusic();
    this.emit();
  }

  pause() { if (this.phase === "playing") { this.phase = "paused"; this.emit(); } }
  resumePlay() { if (this.phase === "paused") { this.phase = "playing"; this.emit(); } }
  goMenu() { this.phase = "menu"; this.emit(); }
  goShop() { this.phase = "shop"; this.emit(); }
  goSettings() { this.phase = "settings"; this.emit(); }

  tap() {
    if (this.phase !== "playing") return;
    this.ninjaSide = (this.ninjaSide * -1) as Side;
    this.ninjaSpin = 1;
    this.spinDir = this.ninjaSide;
    audio.sfx("swap");
    this.spawnSwapPuff();
    if (this.save.settings.haptics && "vibrate" in navigator) navigator.vibrate?.(12);
  }

  continueWithAd() {
    if (!this.canContinue || this.phase !== "gameover") return;
    this.canContinue = false;
    this.lives = 1;
    this.invulnUntil = performance.now() / 1000 + 2;
    this.speed = Math.max(BASE_SPEED, MAX_SPEED * resetPct(this.worldY));
    this.combo = 0;
    this.phase = "playing";
    this.emit();
  }

  endRun() {
    // commit best + coins
    if (Math.floor(this.worldY) > this.save.best) {
      this.save.best = Math.floor(this.worldY);
      audio.sfx("best");
    }
    this.save.coins += this.coinsRun;
    saveSave(this.save);
    this.phase = "gameover";
    audio.sfx("over");
    this.emit();
  }

  // shop
  buy(kind: "char" | "rope" | "trail", id: string, price: number): boolean {
    if (this.save.coins < price) return false;
    const slot = kind === "char" ? "chars" : kind === "rope" ? "ropes" : "trails";
    if (!this.save.unlocked[slot].includes(id)) {
      this.save.unlocked[slot].push(id);
      this.save.coins -= price;
    }
    this.save.equipped[kind] = id;
    saveSave(this.save);
    audio.sfx("milestone");
    this.emit();
    return true;
  }
  equip(kind: "char" | "rope" | "trail", id: string) {
    this.save.equipped[kind] = id;
    saveSave(this.save);
    audio.sfx("ui");
    this.emit();
  }
  setSetting(k: "sfx" | "music" | "haptics", v: boolean) {
    this.save.settings[k] = v;
    if (k === "sfx") audio.setSfx(v);
    if (k === "music") audio.setMusic(v);
    saveSave(this.save);
    this.emit();
  }

  // ---------- loop ----------

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.W = rect.width;
    this.H = rect.height;
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.dpr = dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  start() {
    this.running = true;
    this.lastT = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.lastT) / 1000);
      this.lastT = t;
      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private update(dt: number) {
    if (this.phase !== "playing") {
      // still drift particles softly so menu has petals
      this.updateParticles(dt);
      audio.updateMusic((this.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));
      return;
    }

    const now = performance.now() / 1000;
    const eff = dt;

    // speed
    this.speed = Math.min(MAX_SPEED, this.speed + SPEED_ACCEL * eff);
    this.worldY += this.speed * eff;

    // theme crossfade — day -> sunset -> night -> void, then non-repeating
    // exotic palettes so the background never repeats in a run.
    const themeBand = 300;
    const bandPos = this.worldY / themeBand;
    const bandInt = Math.floor(bandPos);
    if (bandInt !== this.themeBandIndex) {
      this.themeBandIndex = bandInt;
      this.prevThemeIndex = this.themeIndex;
      this.themeIndex = this.pickNextTheme(bandInt);
    }
    // continuous progress within current band = crossfade amount
    this.themeT = bandPos - bandInt;
    this.updateClouds(dt);


    // ninja anim
    if (this.ninjaSpin > 0) this.ninjaSpin = Math.max(0, this.ninjaSpin - dt * 5);

    // spawn obstacles
    while (this.nextSpawnY < this.worldY + 30) {
      this.spawnObstacle(this.nextSpawnY);
      this.nextSpawnY += bandSpawnGap(this.worldY, this.speed);
    }

    this.updateObstacles(eff);
    this.updateParticles(dt);

    // trail
    if (Math.random() < 0.6) this.spawnTrail();


    // shake decay
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 12);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 4);

    if (performance.now() > this.comboFlashUntil && this.comboFlashLabel) {
      this.comboFlashLabel = null;
    }

    audio.updateMusic((this.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED));

    // emit at ~10Hz to update HUD smoothly without thrash
    if ((performance.now() | 0) % 100 < 17) this.emit();
  }

  // ---------- spawning ----------

  private getObs(): Obstacle | null {
    for (const o of this.obstacles) if (!o.active) return o;
    return null;
  }
  private getCoin(): Coin | null {
    for (const c of this.coins) if (!c.active) return c;
    return null;
  }
  private getParticle(): Particle | null {
    for (const p of this.particles) if (!p.active) return p;
    return null;
  }

  private spawnObstacle(y: number) {
    const o = this.getObs();
    if (!o) return;
    const kinds = bandKinds(this.worldY);
    const kind = kinds[(Math.random() * kinds.length) | 0];
    // Always pick a single side so the player can always dodge
    const side: Side = Math.random() < 0.5 ? -1 : 1;
    o.active = true;
    o.kind = kind;
    o.y = y;
    o.side = side;
    o.phase = Math.random() * Math.PI * 2;
    o.passed = false;
    o.hit = false;
  }

  private spawnCoin(y: number) {
    const c = this.getCoin();
    if (!c) return;
    // Bias coins to dangerous side: pick the side that has the next obstacle
    let dangerSide: Side = Math.random() < 0.5 ? -1 : 1;
    for (const o of this.obstacles) {
      if (o.active && Math.abs(o.y - y) < 6 && o.side !== 0) { dangerSide = o.side as Side; break; }
    }
    c.active = true;
    c.y = y;
    c.side = (Math.random() < 0.65 ? dangerSide : (-dangerSide as Side));
    c.collected = false;
    c.spin = Math.random() * Math.PI * 2;
  }

  private updateObstacles(dt: number) {
    const ninjaY = this.worldY;
    const now = performance.now() / 1000;
    for (const o of this.obstacles) {
      if (!o.active) continue;
      if (o.kind === "arrow") {
        const prev = o.phase;
        o.phase += dt;
        // spawn small flame trail while flying
        if (o.phase > ARROW_WARN && o.phase < ARROW_TOTAL && Math.random() < 0.9) {
          this.spawnArrowFlame(o.side as Side, o.phase);
        }
        // detect crossing of ninja Y (H*0.55). Screen y goes from H+20 -> -20 over ARROW_FLY.
        const hitP = (this.H + 20 - this.H * 0.55) / (this.H + 40);
        const flyPrev = (prev - ARROW_WARN) / ARROW_FLY;
        const flyNow = (o.phase - ARROW_WARN) / ARROW_FLY;
        if (!o.hit && now > this.invulnUntil && flyPrev < hitP && flyNow >= hitP) {
          const onSide = o.side === this.ninjaSide;
          if (onSide) { o.hit = true; this.takeHit(); }
        }
        if (o.phase >= ARROW_TOTAL) {
          if (!o.hit && !o.passed) {
            o.passed = true;
            this.combo++;
            if (this.combo % 5 === 0) audio.sfx("combo");
          }
          o.active = false;
        }
        continue;
      }
      o.phase += dt * (o.kind === "blade" ? 6 : 2);
      // off screen below (above on screen since environment scrolls up)
      if (o.y < ninjaY - 20) {
        if (!o.hit && !o.passed) {
          o.passed = true;
          this.combo++;
          if (this.combo % 5 === 0) audio.sfx("combo");
        }
        o.active = false;
        continue;
      }
      // collision: within 1.4m of ninja and on same side (or both)
      if (!o.hit && now > this.invulnUntil && Math.abs(o.y - ninjaY) < 1.4) {
        const onSide = o.side === 0 || o.side === this.ninjaSide;
        const blade = o.kind === "blade"; // blades sweep — only dangerous part of cycle
        const dangerous = !blade || Math.sin(o.phase) > 0;
        if (onSide && dangerous) {
          o.hit = true;
          this.takeHit();
        }
      }
    }
  }

  private updateCoins() {
    const ninjaY = this.worldY;
    for (const c of this.coins) {
      if (!c.active) continue;
      c.spin += 0.15;
      if (c.y < ninjaY - 20) { c.active = false; continue; }
      if (!c.collected && Math.abs(c.y - ninjaY) < 1.2 && c.side === this.ninjaSide) {
        c.collected = true;
        c.active = false;
        const mult = this.combo >= 10 ? 2 : 1;
        this.coinsRun += mult;
        audio.sfx("coin");
        // sparkle
        for (let i = 0; i < 6; i++) this.emitSpark(c.side);
      }
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "smoke") { p.vx *= 0.94; p.vy *= 0.94; }
    }
  }

  private takeHit() {
    this.lives--;
    this.combo = 0;
    
    audio.sfx("hit");
    this.shake = 1;
    this.hitFlash = 1;
    this.invulnUntil = performance.now() / 1000 + 1;
    this.speed = Math.max(BASE_SPEED, MAX_SPEED * resetPct(this.worldY));
    // hit burst
    for (let i = 0; i < 14; i++) this.emitHit();
    if (this.save.settings.haptics && "vibrate" in navigator) navigator.vibrate?.([40, 40, 60, 40, 80]);
    if (this.lives <= 0) this.endRun();
  }

  // ---------- particles ----------

  private trailColor(): string {
    return findTrail(this.save.equipped.trail).color;
  }

  private spawnSwapPuff() {
    for (let i = 0; i < 8; i++) {
      const p = this.getParticle();
      if (!p) return;
      p.active = true;
      p.kind = "smoke";
      p.x = this.W / 2 + (-this.ninjaSide) * 26 + (Math.random() - 0.5) * 10;
      p.y = this.H * 0.55 + (Math.random() - 0.5) * 14;
      p.vx = (-this.ninjaSide) * (20 + Math.random() * 30);
      p.vy = (Math.random() - 0.5) * 30;
      p.life = 0.5;
      p.max = 0.5;
      p.color = this.trailColor();
      p.size = 6 + Math.random() * 4;
    }
  }

  private spawnTrail() {
    const p = this.getParticle();
    if (!p) return;
    p.active = true;
    const trail = findTrail(this.save.equipped.trail);
    p.kind = trail.kind === "fire" || trail.kind === "lightning" ? "spark" : "smoke";
    p.x = this.W / 2 + this.ninjaSide * 22 + (Math.random() - 0.5) * 6;
    p.y = this.H * 0.55 + 14;
    p.vx = (Math.random() - 0.5) * 10;
    p.vy = 30 + Math.random() * 20;
    p.life = 0.4;
    p.max = 0.4;
    p.color = trail.color;
    p.size = 4 + Math.random() * 3;
  }

  private emitSpark(side: Side) {
    const p = this.getParticle();
    if (!p) return;
    p.active = true;
    p.kind = "spark";
    p.x = this.W / 2 + side * 22;
    p.y = this.H * 0.55;
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 60;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.life = 0.45;
    p.max = 0.45;
    p.color = "#ffd966";
    p.size = 3;
  }
  private emitHit() {
    const p = this.getParticle();
    if (!p) return;
    p.active = true;
    p.kind = "hit";
    p.x = this.W / 2 + this.ninjaSide * 22;
    p.y = this.H * 0.55;
    const a = Math.random() * Math.PI * 2;
    const s = 80 + Math.random() * 120;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.life = 0.6;
    p.max = 0.6;
    p.color = "#ff5a4a";
    p.size = 4;
  }
  private spawnArrowFlame(side: Side, phase: number) {
    const p = this.getParticle();
    if (!p) return;
    const flyP = Math.max(0, Math.min(1, (phase - ARROW_WARN) / ARROW_FLY));
    const sy = (this.H + 20) + (-this.H - 40) * flyP;
    p.active = true;
    p.kind = "spark";
    p.x = this.W / 2 + side * 28 + (Math.random() - 0.5) * 6;
    p.y = sy + 14 + Math.random() * 8;
    p.vx = (Math.random() - 0.5) * 20;
    p.vy = 40 + Math.random() * 40;
    p.life = 0.35;
    p.max = 0.35;
    p.color = Math.random() < 0.5 ? "#ffb347" : "#ff5a1f";
    p.size = 3 + Math.random() * 2;
  }

  // ---------- render ----------

  private lerpColor(a: string, b: string, t: number): string {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
    const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    const hex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(bl)}`;
  }

  private rgba(hexColor: string, alpha: number): string {
    const v = parseInt(hexColor.slice(1), 16);
    const r = (v >> 16) & 255;
    const g = (v >> 8) & 255;
    const b = v & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  private roundedRect(x: number, y: number, w: number, h: number, r: number) {
    const { ctx } = this;
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  private themeMix<K extends keyof ThemePalette>(k: K): string {
    const a = THEMES[this.prevThemeIndex][k] as string;
    const b = THEMES[this.themeIndex][k] as string;
    if (typeof a !== "string" || a[0] !== "#") return b as string;
    return this.lerpColor(a, b, this.themeT);
  }

  // pick the next theme for a given band index.
  // Bands 0..FIXED_INTRO_COUNT-1 are the fixed intro cycle (day/sunset/night/void).
  // After that, refill from a shuffled queue of exotic palettes without repeats,
  // so the background never repeats within a single run.
  private pickNextTheme(bandInt: number): number {
    if (bandInt < FIXED_INTRO_COUNT) return bandInt;
    if (this.themeQueue.length === 0) {
      const pool: number[] = [];
      for (let i = FIXED_INTRO_COUNT; i < THEMES.length; i++) pool.push(i);
      // Fisher–Yates
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      // ensure first pick isn't the theme we just left
      if (pool[0] === this.themeIndex && pool.length > 1) {
        [pool[0], pool[1]] = [pool[1], pool[0]];
      }
      this.themeQueue = pool;
    }
    return this.themeQueue.shift()!;
  }

  private render() {
    const { ctx, W, H } = this;
    // shake
    let ox = 0, oy = 0;
    if (this.shake > 0) {
      ox = (Math.random() - 0.5) * this.shake * 10;
      oy = (Math.random() - 0.5) * this.shake * 10;
    }
    ctx.save();
    ctx.translate(ox, oy);

    // flat cartoon sky — single full-height band
    ctx.fillStyle = this.themeMix("bg");
    ctx.fillRect(0, 0, W, H);


    this.renderBackground();

    this.renderRope();
    this.renderObstacles();
    this.renderCoins();
    this.renderParticles();
    this.renderNinja();

    // comic speed lines behind everything at high speed
    const speedPct = (this.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
    if (this.phase === "playing" && speedPct > 0.3) {
      const intensity = (speedPct - 0.3) / 0.7;
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.35 + intensity * 0.35;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      const seed = (this.worldY * 40) | 0;
      const lineCount = 4 + Math.floor(intensity * 6);
      for (let i = 0; i < lineCount; i++) {
        const s = ((seed + i * 977) % 1000) / 1000;
        const side = i % 2 === 0 ? 0.08 + s * 0.18 : 0.74 + s * 0.18;
        const lx = side * W;
        const ly = ((seed * 0.7 + i * 613) % H) * 1;
        const len = 24 + intensity * 46;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly + len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // hit flash
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,80,80,${this.hitFlash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }

    // invuln shimmer
    const now = performance.now() / 1000;
    if (now < this.invulnUntil) {
      const a = (Math.sin(now * 30) + 1) * 0.06;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  private initClouds() {
    const configs = [
      { spacing: 360, minS: 0.45, maxS: 0.75, speedMult: 2.5 },
      { spacing: 220, minS: 0.75, maxS: 1.05, speedMult: 5.5 },
      { spacing: 150, minS: 1.1, maxS: 1.55, speedMult: 8.5 },
    ];
    const speedRatio = this.speed / BASE_SPEED;
    const cloudMargin = 120 * speedRatio;
    const H = this.H;
    this.cloudLayers = configs.map((cfg) => {
      const count = Math.ceil((H + cloudMargin * 2) / cfg.spacing) + 2;
      const arr: { y: number; x: number; s: number; shape: number }[] = [];
      for (let i = 0; i < count; i++) {
        arr.push({
          y: H + cloudMargin - i * cfg.spacing,
          x: 40 + Math.random() * (this.W - 80),
          s: cfg.minS + Math.random() * (cfg.maxS - cfg.minS),
          shape: Math.floor(Math.random() * 6),
        });
      }
      return arr;
    });
  }

  private updateClouds(dt: number) {
    const configs = [
      { spacing: 360, minS: 0.45, maxS: 0.75, speedMult: 2.5 },
      { spacing: 220, minS: 0.75, maxS: 1.05, speedMult: 5.5 },
      { spacing: 150, minS: 1.1, maxS: 1.55, speedMult: 8.5 },
    ];
    const speedRatio = this.speed / BASE_SPEED;
    const cloudMargin = 120 * speedRatio;
    const H = this.H;

    // suppress cloud presence while inside/entering the void theme
    const voidCur = THEMES[this.themeIndex].id === "void" ? 1 : 0;
    const voidPrev = THEMES[this.prevThemeIndex].id === "void" ? 1 : 0;
    const voidAmt = voidPrev * (1 - this.themeT) + voidCur * this.themeT;
    const suppressSpawn = voidAmt > 0.4;

    for (let li = 0; li < 3; li++) {
      const cfg = configs[li];
      const drift = this.speed * cfg.speedMult;
      const layer = this.cloudLayers[li];

      const needed = Math.ceil((H + cloudMargin * 2) / cfg.spacing) + 2;
      if (!suppressSpawn) {
        while (layer.length < needed) {
          const maxY = layer.length > 0 ? Math.max(...layer.map((c) => c.y)) : H + cloudMargin;
          layer.push({
            y: maxY + cfg.spacing,
            x: 40 + Math.random() * (this.W - 80),
            s: cfg.minS + Math.random() * (cfg.maxS - cfg.minS),
            shape: Math.floor(Math.random() * 6),
          });
        }
      }

      for (const c of layer) {
        c.y -= drift * dt;
      }

      // recycle off-screen clouds only when not suppressed; otherwise let them drain
      if (!suppressSpawn) {
        let maxY = layer.length > 0 ? Math.max(...layer.map((c) => c.y)) : H + cloudMargin;
        for (const c of layer) {
          if (c.y < -cloudMargin) {
            c.y = maxY + cfg.spacing;
            maxY = c.y;
            c.x = 40 + Math.random() * (this.W - 80);
            c.s = cfg.minS + Math.random() * (cfg.maxS - cfg.minS);
            c.shape = Math.floor(Math.random() * 6);
          }
        }
      } else {
        // drop clouds that have fully scrolled past so they don't linger
        for (let i = layer.length - 1; i >= 0; i--) {
          if (layer[i].y < -cloudMargin) layer.splice(i, 1);
        }
      }
    }
  }

  private renderCloud(cx: number, cy: number, s: number, simple: boolean, shape: number) {
    const { ctx } = this;
    const puffSets: [number, number, number][][] = [
      // 0: wide flat
      [
        [-36 * s, 4 * s, 14 * s],
        [-14 * s, -2 * s, 16 * s],
        [8 * s, 2 * s, 15 * s],
        [28 * s, 6 * s, 12 * s],
      ],
      // 1: lumpy tall
      [
        [-20 * s, 8 * s, 13 * s],
        [0 * s, -10 * s, 17 * s],
        [18 * s, 4 * s, 14 * s],
        [-6 * s, -22 * s, 11 * s],
        [10 * s, -18 * s, 10 * s],
      ],
      // 2: small scattered
      [
        [-22 * s, -4 * s, 11 * s],
        [-4 * s, -10 * s, 13 * s],
        [16 * s, -2 * s, 10 * s],
        [32 * s, -8 * s, 9 * s],
        [8 * s, 6 * s, 9 * s],
      ],
      // 3: classic medium
      [
        [-26 * s, 6 * s, 15 * s],
        [-8 * s, -8 * s, 17 * s],
        [14 * s, -2 * s, 14 * s],
        [30 * s, 8 * s, 12 * s],
        [-2 * s, 10 * s, 13 * s],
      ],
      // 4: dense round
      [
        [-18 * s, 0 * s, 16 * s],
        [0 * s, -12 * s, 18 * s],
        [16 * s, 2 * s, 15 * s],
        [-6 * s, 10 * s, 14 * s],
        [10 * s, -6 * s, 14 * s],
      ],
      // 5: stretched
      [
        [-44 * s, 2 * s, 13 * s],
        [-22 * s, -4 * s, 15 * s],
        [0 * s, 0 * s, 16 * s],
        [22 * s, -2 * s, 14 * s],
        [42 * s, 4 * s, 12 * s],
        [-10 * s, -12 * s, 10 * s],
      ],
    ];
    const puffs = simple && shape > 2 ? puffSets[shape % 3] : puffSets[shape];
    // soft underside shadow
    ctx.fillStyle = "rgba(90,110,150,0.22)";
    ctx.beginPath();
    for (const [dx, dy, r] of puffs) ctx.arc(cx + dx, cy + dy + 6, r, 0, Math.PI * 2);
    ctx.fill();
    // outline
    ctx.fillStyle = INK;
    ctx.beginPath();
    for (const [dx, dy, r] of puffs) ctx.arc(cx + dx, cy + dy, r + 2, 0, Math.PI * 2);
    ctx.fill();
    // main body
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    for (const [dx, dy, r] of puffs) ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
    ctx.fill();
    // highlight
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    for (const [dx, dy, r] of puffs) {
      if (r > 10 * s) {
        ctx.arc(cx + dx - r * 0.3, cy + dy - r * 0.45, r * 0.3, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }

  private renderBackground() {
    const { ctx, W, H } = this;
    const lantern = this.themeMix("lantern");

    const speedRatio = this.speed / BASE_SPEED;
    const cloudMargin = 120 * speedRatio;
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;

    const layerConfigs = [
      { alpha: 0.42, simple: true },
      { alpha: 0.78, simple: false },
      { alpha: 1.0, simple: false },
    ];

    // fade clouds out while the void theme is active
    const voidCurAmt = THEMES[this.themeIndex].id === "void" ? 1 : 0;
    const voidPrevAmt = THEMES[this.prevThemeIndex].id === "void" ? 1 : 0;
    const voidAmt = voidPrevAmt * (1 - this.themeT) + voidCurAmt * this.themeT;
    const cloudVis = 1 - voidAmt;

    // far -> near for correct overlap
    for (let li = 0; li < 3; li++) {
      const layer = this.cloudLayers[li];
      const cfg = layerConfigs[li];
      const sorted = layer.slice().sort((a, b) => b.y - a.y);
      for (const cloud of sorted) {
        const cy = cloud.y;
        if (cy < -cloudMargin || cy > H + cloudMargin) continue;
        const cx = cloud.x;
        const s = cloud.s;

        const fadeIn = Math.min(1, (H + cloudMargin - cy) / cloudMargin);
        const fadeOut = Math.min(1, (cy + cloudMargin) / cloudMargin);
        const alpha = Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut))) * cfg.alpha * cloudVis;
        if (alpha <= 0.01) continue;
        ctx.globalAlpha = alpha;
        this.renderCloud(cx, cy, s, cfg.simple, cloud.shape);
      }
    }
    ctx.globalAlpha = 1;


    // sky details blend per-theme celestial + night intensity
    const cur = THEMES[this.themeIndex];
    const prev = THEMES[this.prevThemeIndex];
    const mix = (a: number, b: number) => a * (1 - this.themeT) + b * this.themeT;

    // stars — crossfade night intensity between themes; scroll with worldY
    // across parallax layers to sell the falling look (especially in void).
    // Scroll rate and twinkle intensity scale smoothly with falling speed.
    const nightAmt = mix(prev.night ?? 0, cur.night ?? 0);
    if (nightAmt > 0.05) {
      const starSeed = 1337;
      const speedRatio = this.speed / BASE_SPEED;
      const starSpeedMult = 0.85 + 0.35 * speedRatio;
      const twinkleFreq = speedRatio / 320;
      const twinkleAmp = 0.25 + 0.35 * Math.min(speedRatio, 2.2);
      const starLayers = [
        { count: 40, speed: 18, size: 1.0 },
        { count: 40, speed: 42, size: 1.2 },
        { count: 25, speed: 90, size: 1.7 },
      ];
      const now = performance.now();
      const spanH = H + 40;
      let idx = 0;
      for (const sl of starLayers) {
        for (let i = 0; i < sl.count; i++, idx++) {
          const sx = ((idx * 733 + starSeed) % 1000) / 1000 * W;
          const baseY = ((idx * 991 + starSeed) % 1000) / 1000 * spanH;
          const sy = ((baseY + this.worldY * sl.speed * starSpeedMult) % spanH + spanH) % spanH - 20;
          const twinkle = 0.55 + twinkleAmp * Math.sin(now * twinkleFreq + idx);
          ctx.globalAlpha = Math.min(1, nightAmt * Math.max(0, twinkle));
          ctx.fillStyle = `rgb(255,255,240)`;
          ctx.beginPath();
          ctx.arc(sx, sy, sl.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    // celestial disc — sun/moon fades in/out based on adjacent themes
    const drawDisc = (cx: number, cy: number, r: number, fill: string, isMoon: boolean) => {
      ctx.fillStyle = fill;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (isMoon) {
        ctx.fillStyle = this.themeMix("bg");
        ctx.beginPath();
        ctx.arc(cx + r * 0.45, cy - r * 0.15, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const sunAlpha =
      (prev.celestial === "sun" ? 1 - this.themeT : 0) +
      (cur.celestial === "sun" ? this.themeT : 0);
    const moonAlpha =
      (prev.celestial === "moon" ? 1 - this.themeT : 0) +
      (cur.celestial === "moon" ? this.themeT : 0);

    // arc position tied to progress within the current band
    const t = this.themeT;
    const cxPos = 60 + t * (W - 120);
    const cyPos = H + 40 - Math.sin(Math.PI * t) * (H - 40);

    if (sunAlpha > 0.02) {
      ctx.globalAlpha = sunAlpha;
      drawDisc(cxPos, cyPos, 24, lantern, false);
      ctx.globalAlpha = 1;
    }
    if (moonAlpha > 0.02) {
      ctx.globalAlpha = moonAlpha;
      drawDisc(cxPos, cyPos, 20, "#f4f0d0", true);
      ctx.globalAlpha = 1;
    }
  }




  private renderRope() {
    const { ctx, H } = this;
    const rope = findRope(this.save.equipped.rope);
    const x = this.W / 2;
    const color = rope.color;

    // thick black outline stroke behind the rope
    ctx.strokeStyle = INK;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();

    // flat colored rope stroke
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();

    // style-specific inked details
    const off = ((-this.worldY * 60) % 18 + 18) % 18;
    if (rope.style === "chain") {
      // stacked pill links, outlined
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      for (let y = -18 + off; y < H; y += 18) {
        ctx.fillStyle = color;
        this.roundedRect(x - 5, y, 10, 14, 5);
        ctx.fill();
        ctx.stroke();
      }
    } else if (rope.style === "vine") {
      // little leaves alternating sides
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      let flip = 0;
      for (let y = -14 + off; y < H; y += 22) {
        const s = flip % 2 === 0 ? 1 : -1;
        ctx.fillStyle = "#7bc450";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + s * 14, y - 4, x + s * 16, y + 6);
        ctx.quadraticCurveTo(x + s * 8, y + 8, x, y + 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        flip++;
      }
    } else {
      // rope / neon: black tick marks for braid feel
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      for (let y = -10 + off; y < H; y += 12) {
        ctx.beginPath();
        ctx.moveTo(x - 4, y);
        ctx.lineTo(x + 4, y + 6);
        ctx.stroke();
      }
    }
  }

  private worldToScreenY(yMeters: number): number {
    // ninja is at H*0.55; obstacles approach from below and rise upward
    return this.H * 0.55 + (yMeters - this.worldY) * 28;
  }



  private renderObstacles() {
    const { ctx, W } = this;
    for (const o of this.obstacles) {
      if (!o.active) continue;
      if (o.kind === "arrow") {
        this.renderArrow(o);
        continue;
      }
      const sy = this.worldToScreenY(o.y);
      if (sy < -40 || sy > this.H + 40) continue;
      const renderSide = (side: Side) => {
        const x = W / 2 + side * 28;
        ctx.save();
        ctx.translate(x, sy);
        ctx.lineJoin = "round";
        switch (o.kind) {
          case "spike": {
            // bright cartoon triangle
            ctx.fillStyle = "#ff5d3a";
            ctx.strokeStyle = INK;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(side * -14, 0);
            ctx.lineTo(side * 14, -10);
            ctx.lineTo(side * 14, 10);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // highlight sliver
            ctx.fillStyle = "#ffd7a8";
            ctx.beginPath();
            ctx.moveTo(side * -10, 0);
            ctx.lineTo(side * 6, -5);
            ctx.lineTo(side * 6, -1);
            ctx.closePath();
            ctx.fill();
            // dark base plate
            ctx.fillStyle = "#4a2618";
            ctx.strokeStyle = INK;
            this.roundedRect(side * 12 - 3, -12, 6, 24, 2);
            ctx.fill();
            ctx.stroke();
            break;
          }
          case "blade": {
            const r = 20;
            ctx.rotate(o.phase);
            // yellow disc with outlined gear teeth
            ctx.fillStyle = "#ffd23f";
            ctx.strokeStyle = INK;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2;
              const rr = i % 2 === 0 ? r : r - 6;
              const px = Math.cos(a) * rr;
              const py = Math.sin(a) * rr;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // dark hub
            ctx.fillStyle = INK;
            ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#ff5d3a";
            ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
            break;
          }
        }
        ctx.restore();
      };
      if (o.side === 0) { renderSide(-1); renderSide(1); }
      else renderSide(o.side as Side);
    }
  }


  private renderArrow(o: Obstacle) {
    const { ctx, W, H } = this;
    const side = (o.side || 1) as Side;
    const x = W / 2 + side * 28;
    if (o.phase < ARROW_WARN) {
      const t = o.phase / ARROW_WARN;
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(o.phase * 18));
      const wy = H - 46;
      ctx.save();
      ctx.translate(x, wy);
      ctx.lineJoin = "round";
      // flat warning triangle
      ctx.fillStyle = `rgba(255,210,60,${0.9 * pulse + 0.1})`;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(13, 10);
      ctx.lineTo(-13, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.fillRect(-1.5, -8, 3, 10);
      ctx.fillRect(-1.5, 5, 3, 3);
      // chevrons
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const cy = 22 + i * 8 - t * 10;
        ctx.beginPath();
        ctx.moveTo(-8, cy + 4);
        ctx.lineTo(0, cy - 2);
        ctx.lineTo(8, cy + 4);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    // flying cartoon arrow
    const flyP = (o.phase - ARROW_WARN) / ARROW_FLY;
    const sy = (H + 20) + (-H - 40) * flyP;
    ctx.save();
    ctx.translate(x, sy);
    ctx.lineJoin = "round";
    // shaft
    ctx.fillStyle = "#8a5a2a";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    this.roundedRect(-2, -10, 4, 22, 1.5);
    ctx.fill();
    ctx.stroke();
    // arrowhead
    ctx.fillStyle = "#e8e2d0";
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(8, -6);
    ctx.lineTo(-8, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // fletching (bright)
    ctx.fillStyle = "#ff5d3a";
    ctx.beginPath();
    ctx.moveTo(-2, 10);
    ctx.lineTo(-8, 16);
    ctx.lineTo(-2, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, 10);
    ctx.lineTo(8, 16);
    ctx.lineTo(2, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }


  private renderCoins() {
    const { ctx, W } = this;
    for (const c of this.coins) {
      if (!c.active) continue;
      const sy = this.worldToScreenY(c.y);
      if (sy < -20 || sy > this.H + 20) continue;
      const x = W / 2 + c.side * 28;
      const w = Math.abs(Math.cos(c.spin)) * 9 + 3;
      ctx.fillStyle = "#ffd23f";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, sy, w, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // "S" mark
      ctx.strokeStyle = "#8a5a1a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.35, sy - 3);
      ctx.lineTo(x + w * 0.35, sy - 3);
      ctx.moveTo(x - w * 0.35, sy + 3);
      ctx.lineTo(x + w * 0.35, sy + 3);
      ctx.stroke();
    }
  }

  private renderParticles() {
    const { ctx } = this;
    ctx.lineJoin = "round";
    for (const p of this.particles) {
      if (!p.active) continue;
      const a = Math.max(0, p.life / p.max);
      if (p.kind === "smoke") {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        const r = p.size * (1 + (1 - a) * 1.2);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.kind === "spark") {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.kind === "hit") {
        // comic starburst point
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        const s = p.size * 1.6;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const rr = i % 2 === 0 ? s : s * 0.45;
          const px = p.x + Math.cos(ang) * rr;
          const py = p.y + Math.sin(ang) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private renderNinja() {
    const { ctx, W, H } = this;
    const ch = findChar(this.save.equipped.char);
    const x = W / 2 + this.ninjaSide * 22;
    const y = H * 0.55;
    const spin = this.ninjaSpin;
    const now = performance.now() / 1000;
    const invuln = now < this.invulnUntil;

    // flat oval shadow beneath
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(x, y + 16, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    if (spin > 0) {
      const ang = (1 - spin) * Math.PI * 2 * this.spinDir;
      ctx.rotate(ang);
    }
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;

    // body (flat)
    ctx.fillStyle = ch.body;
    ctx.lineWidth = 2.5;
    this.roundedRect(-10, -14, 20, 26, 6);
    ctx.fill();
    ctx.stroke();

    // cel-shade highlight wedge on the body
    ctx.save();
    ctx.beginPath();
    this.roundedRect(-10, -14, 20, 26, 6);
    ctx.clip();
    ctx.fillStyle = this.lerpColor(ch.body, "#ffffff", 0.22);
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.lineTo(-2, -14);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // sash
    ctx.fillStyle = ch.sash;
    ctx.lineWidth = 2.5;
    this.roundedRect(-11, -4, 22, 5, 2);
    ctx.fill();
    ctx.stroke();

    // arm gripping rope
    ctx.fillStyle = ch.body;
    ctx.lineWidth = 2;
    this.roundedRect(this.ninjaSide * -13, -9, 7, 5, 2);
    ctx.fill();
    ctx.stroke();

    // head
    ctx.fillStyle = ch.body;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -17, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // mask band (headband color)
    ctx.fillStyle = ch.trim;
    ctx.lineWidth = 2;
    this.roundedRect(-9, -20, 18, 5, 1.5);
    ctx.fill();
    ctx.stroke();
    // headband tail flapping
    const flap = Math.sin(performance.now() / 120) * 2;
    ctx.fillStyle = ch.trim;
    ctx.beginPath();
    ctx.moveTo(this.ninjaSide * 9, -19);
    ctx.lineTo(this.ninjaSide * 18, -22 + flap);
    ctx.lineTo(this.ninjaSide * 18, -17 + flap);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // big cartoon eyes (whites)
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-3.5, -14, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(3.5, -14, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // pupils (look toward direction of motion)
    ctx.fillStyle = INK;
    const px = this.ninjaSide * 0.9;
    ctx.beginPath();
    ctx.arc(-3.5 + px, -13.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3.5 + px, -13.5, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // little smile
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -9, 2.5, 0, Math.PI);
    ctx.stroke();

    // invuln flash outline
    if (invuln) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      this.roundedRect(-12, -24, 24, 38, 8);
      ctx.stroke();
    }

    ctx.restore();
  }
}

