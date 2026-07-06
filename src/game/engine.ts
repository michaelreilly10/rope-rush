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

const THEMES: ThemePalette[] = [
  {
    id: "rooftops",
    name: "Sunny Rooftops",
    bg: "#8ec7ff",
    bgFar: "#5aa8ff",
    bgNear: "#f6c744",
    beam: "#c76b2a",
    accent: "#ff5d5d",
    lantern: "#ffd23f",
  },
  {
    id: "jungle",
    name: "Jungle Cartoon",
    bg: "#b7e86a",
    bgFar: "#5aa84a",
    bgNear: "#2f6b2a",
    beam: "#7a4a1a",
    accent: "#ff8a3d",
    lantern: "#ffe14a",
  },
  {
    id: "sunset",
    name: "Comic Sunset",
    bg: "#ffd06a",
    bgFar: "#ff8a3d",
    bgNear: "#c74a6b",
    beam: "#5a2a5a",
    accent: "#3ac0ff",
    lantern: "#fff2a8",
  },
];

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
  canContinue = true; // one ad continue per run

  // pools
  obstacles: Obstacle[] = [];
  coins: Coin[] = [];
  particles: Particle[] = [];

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

    // theme crossfade
    const themeBand = 800;
    const wantTheme = Math.floor(this.worldY / themeBand) % THEMES.length;
    if (wantTheme !== this.themeIndex) {
      this.prevThemeIndex = this.themeIndex;
      this.themeIndex = wantTheme;
      this.themeT = 0;
    }
    if (this.themeT < 1) this.themeT = Math.min(1, this.themeT + eff * 0.5);

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

    // flat cartoon sky (two horizontal bands, no gradient)
    ctx.fillStyle = this.themeMix("bg");
    ctx.fillRect(0, 0, W, H * 0.55);
    ctx.fillStyle = this.themeMix("bgFar");
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
    // horizon line
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.55);
    ctx.lineTo(W, H * 0.55);
    ctx.stroke();

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

  private renderBackground() {
    const { ctx, W, H } = this;
    const bgNear = this.themeMix("bgNear");
    const beam = this.themeMix("beam");
    const lantern = this.themeMix("lantern");

    // parallax clouds (upper sky) — big flat rounded blobs with black outlines
    const cloudSpacing = 180;
    const coff = ((-this.worldY * 6) % cloudSpacing + cloudSpacing) % cloudSpacing;
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    for (let i = -1; i < 5; i++) {
      const cy = -60 + i * cloudSpacing + coff;
      if (cy > H * 0.55) continue;
      const seedA = ((i * 733) % 1000) / 1000;
      const cx = seedA * (W - 60) + 30;
      const s = 0.85 + ((i * 311) % 100) / 250;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.arc(cx, cy, 18 * s, 0, Math.PI * 2);
      ctx.arc(cx + 20 * s, cy + 4, 14 * s, 0, Math.PI * 2);
      ctx.arc(cx - 22 * s, cy + 6, 15 * s, 0, Math.PI * 2);
      ctx.arc(cx + 4, cy - 8 * s, 12 * s, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // distant flat skyline silhouette along the horizon
    ctx.fillStyle = bgNear;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    const skyH = H * 0.55;
    ctx.beginPath();
    ctx.moveTo(0, skyH);
    const step = 28;
    const skyOff = ((this.worldY * 4) % step + step) % step;
    let x = -skyOff;
    let toggle = 0;
    while (x < W + step) {
      const h = 20 + (((x * 37) | 0) % 30);
      ctx.lineTo(x, skyH - h);
      ctx.lineTo(x + step * 0.5, skyH - h);
      ctx.lineTo(x + step * 0.5, skyH - (h + (toggle % 2 === 0 ? 8 : -6)));
      ctx.lineTo(x + step, skyH - (h + (toggle % 2 === 0 ? 8 : -6)));
      x += step;
      toggle++;
    }
    ctx.lineTo(W, skyH);
    ctx.lineTo(W, H * 0.6);
    ctx.lineTo(0, H * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ground band beneath horizon: flat with dashed cartoon grass tufts
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    const gspacing = 44;
    const goff = ((-this.worldY * 32) % gspacing + gspacing) % gspacing;
    ctx.fillStyle = beam;
    for (let y = H * 0.62; y < H; y += gspacing) {
      const yy = y + goff;
      // little tufts on both sides
      for (let sx = 0; sx < 2; sx++) {
        const tx = sx === 0 ? 20 : W - 20;
        ctx.beginPath();
        ctx.moveTo(tx - 6, yy + 4);
        ctx.lineTo(tx, yy - 6);
        ctx.lineTo(tx + 6, yy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // small sun/moon disc top-right for extra cartoon warmth
    ctx.fillStyle = lantern;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(W - 44, 60, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }


  private renderRope() {
    const { ctx, W, H } = this;
    const rope = findRope(this.save.equipped.rope);
    const x = W / 2;
    const color = rope.color;

    // outer glow
    ctx.shadowBlur = 18;
    ctx.shadowColor = rope.glow || this.rgba(this.themeMix("accent"), 0.6);

    // main rope with vertical gradient (highlight in middle)
    const rg = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
    rg.addColorStop(0, "rgba(0,0,0,0.55)");
    rg.addColorStop(0.5, color);
    rg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.strokeStyle = rg;
    ctx.lineWidth = rope.style === "chain" ? 6 : 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // subtle inner highlight line
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 1.5, 0);
    ctx.lineTo(x - 1.5, H);
    ctx.stroke();

    // braid hatching
    if (rope.style === "rope" || rope.style === "vine") {
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1;
      const off = ((-this.worldY * 50) % 10 + 10) % 10;
      for (let y = -10 + off; y < H; y += 10) {
        ctx.beginPath();
        ctx.moveTo(x - 3, y);
        ctx.lineTo(x + 3, y + 5);
        ctx.stroke();
      }
    }
  }

  private worldToScreenY(yMeters: number): number {
    // ninja is at H*0.55; obstacles approach from below and rise upward
    return this.H * 0.55 + (yMeters - this.worldY) * 28;
  }



  private renderObstacles() {
    const { ctx, W, H } = this;
    for (const o of this.obstacles) {
      if (!o.active) continue;
      // arrows use their own screen positioning + warning glyph
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
        switch (o.kind) {
          case "spike": {
            ctx.shadowBlur = 10;
            ctx.shadowColor = "rgba(255,90,90,0.7)";
            const g = ctx.createLinearGradient(side * -14, 0, side * 14, 0);
            g.addColorStop(0, "#e8e2d0");
            g.addColorStop(1, "#8f877a");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(side * -14, 0);
            ctx.lineTo(side * 14, -10);
            ctx.lineTo(side * 14, 10);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = "rgba(0,0,0,0.45)";
            this.roundedRect(side * 14 - 2, -12, 4, 24, 1.5);
            ctx.fill();
            break;
          }
          case "blade": {
            const r = 22;
            ctx.shadowBlur = 12;
            ctx.shadowColor = "rgba(180,200,255,0.7)";
            ctx.rotate(o.phase);
            const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
            g.addColorStop(0, "#f4f0e6");
            g.addColorStop(1, "#7d7568");
            ctx.fillStyle = g;
            for (let i = 0; i < 4; i++) {
              ctx.rotate(Math.PI / 2);
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(r, -5);
              ctx.lineTo(r, 5);
              ctx.closePath();
              ctx.fill();
            }
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#2a2620";
            ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#ffb86b";
            ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
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
      // pulsing warning glyph at bottom
      const t = o.phase / ARROW_WARN;
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(o.phase * 18));
      const wy = H - 46;
      ctx.save();
      ctx.translate(x, wy);
      // warning triangle
      ctx.shadowBlur = 16;
      ctx.shadowColor = `rgba(255,120,40,${pulse})`;
      ctx.fillStyle = `rgba(255,180,60,${0.85 * pulse})`;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(13, 10);
      ctx.lineTo(-13, 10);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // exclamation mark
      ctx.fillStyle = "#1a0a00";
      ctx.fillRect(-1.5, -8, 3, 10);
      ctx.fillRect(-1.5, 5, 3, 3);
      // upward chevrons hinting incoming vertical arrow
      ctx.strokeStyle = `rgba(255,140,60,${0.7 * pulse})`;
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
    // flying arrow
    const flyP = (o.phase - ARROW_WARN) / ARROW_FLY;
    const sy = (H + 20) + (-H - 40) * flyP;
    ctx.save();
    ctx.translate(x, sy);
    // flame trail behind (below) the arrow
    const trailG = ctx.createLinearGradient(0, 0, 0, 40);
    trailG.addColorStop(0, "rgba(255,200,80,0.9)");
    trailG.addColorStop(0.5, "rgba(255,90,20,0.6)");
    trailG.addColorStop(1, "rgba(255,40,0,0)");
    ctx.fillStyle = trailG;
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.quadraticCurveTo(0, 20, 6, 4);
    ctx.lineTo(4, 36);
    ctx.quadraticCurveTo(0, 44, -4, 36);
    ctx.closePath();
    ctx.fill();
    // shaft
    ctx.shadowBlur = 14;
    ctx.shadowColor = "rgba(255,140,40,0.9)";
    ctx.fillStyle = "#3a2416";
    this.roundedRect(-1.6, -10, 3.2, 22, 1);
    ctx.fill();
    // arrowhead
    ctx.fillStyle = "#e8e2d0";
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(7, -6);
    ctx.lineTo(-7, -6);
    ctx.closePath();
    ctx.fill();
    // fletching
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ff5a1f";
    ctx.beginPath();
    ctx.moveTo(-1.6, 10);
    ctx.lineTo(-6, 16);
    ctx.lineTo(-1.6, 14);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1.6, 10);
    ctx.lineTo(6, 16);
    ctx.lineTo(1.6, 14);
    ctx.closePath();
    ctx.fill();
    // flame licking the head
    ctx.shadowBlur = 12;
    ctx.shadowColor = "rgba(255,180,40,0.9)";
    ctx.fillStyle = "rgba(255,210,110,0.85)";
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.quadraticCurveTo(5, -16, 0, -10);
    ctx.quadraticCurveTo(-5, -16, 0, -22);
    ctx.fill();
    ctx.restore();
  }

  private renderCoins() {
    const { ctx, W } = this;
    for (const c of this.coins) {
      if (!c.active) continue;
      const sy = this.worldToScreenY(c.y);
      if (sy < -20 || sy > this.H + 20) continue;
      const x = W / 2 + c.side * 28;
      const w = Math.abs(Math.cos(c.spin)) * 10 + 2;
      ctx.fillStyle = "#ffd54a";
      ctx.beginPath();
      ctx.ellipse(x, sy, w, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#b8801f";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(x - w * 0.4, sy - 5, 2, 4);
    }
  }

  private renderParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      if (!p.active) continue;
      const a = Math.max(0, p.life / p.max);
      if (p.kind === "smoke") {
        ctx.globalAlpha = a * 0.6;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + (1 - a) * 1.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "spark" || p.kind === "hit") {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
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

    // soft ground shadow / rim glow behind ninja
    const halo = ctx.createRadialGradient(x, y, 0, x, y, 40);
    halo.addColorStop(0, "rgba(0,0,0,0.45)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(x - 40, y - 40, 80, 80);

    ctx.save();
    ctx.translate(x, y);
    if (spin > 0) {
      const ang = (1 - spin) * Math.PI * 2 * this.spinDir;
      ctx.rotate(ang);
    }
    // subtle rim glow
    ctx.shadowBlur = invuln ? 20 : 10;
    ctx.shadowColor = invuln ? "rgba(255,255,255,0.9)" : this.rgba(ch.sash, 0.7);

    // body with gradient
    const bg = ctx.createLinearGradient(-10, -14, 10, 12);
    bg.addColorStop(0, ch.body);
    bg.addColorStop(1, this.lerpColor(ch.body, "#000000", 0.35));
    ctx.fillStyle = bg;
    this.roundedRect(-10, -14, 20, 26, 6);
    ctx.fill();

    // head
    const hg = ctx.createRadialGradient(-2, -18, 1, 0, -16, 9);
    hg.addColorStop(0, this.lerpColor(ch.body, "#ffffff", 0.15));
    hg.addColorStop(1, ch.body);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(0, -16, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // mask band
    ctx.fillStyle = ch.trim;
    this.roundedRect(-7, -18, 14, 3, 1);
    ctx.fill();
    // glowing eyes
    ctx.shadowBlur = 6;
    ctx.shadowColor = "rgba(255,220,120,0.9)";
    ctx.fillStyle = "#fff8d0";
    ctx.fillRect(-5, -18, 3, 2);
    ctx.fillRect(2, -18, 3, 2);
    ctx.shadowBlur = 0;

    // sash
    const sg = ctx.createLinearGradient(-10, -4, 10, 0);
    sg.addColorStop(0, ch.sash);
    sg.addColorStop(1, this.lerpColor(ch.sash, "#ffffff", 0.2));
    ctx.fillStyle = sg;
    this.roundedRect(-10, -4, 20, 4, 1.5);
    ctx.fill();

    // arm gripping rope
    ctx.fillStyle = ch.body;
    this.roundedRect(this.ninjaSide * -12, -8, 6, 4, 1.5);
    ctx.fill();

    ctx.restore();
  }
}

