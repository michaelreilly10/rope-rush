export type Side = -1 | 1; // left | right

export type ObstacleKind = "spike" | "blade" | "fire" | "arrow";

export interface Obstacle {
  active: boolean;
  kind: ObstacleKind;
  y: number; // world Y (meters descended at spawn)
  side: Side | 0; // 0 = both sides
  phase: number; // animation phase
  passed: boolean;
  hit: boolean;
}

export interface Coin {
  active: boolean;
  y: number;
  side: Side;
  collected: boolean;
  spin: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: "smoke" | "spark" | "hit" | "petal";
}

export type GamePhase = "menu" | "playing" | "paused" | "gameover" | "shop" | "settings";

export type ThemeId = "castle" | "temple" | "bamboo";

export interface ThemePalette {
  id: ThemeId;
  name: string;
  bg: string;
  bgFar: string;
  bgNear: string;
  beam: string;
  accent: string;
  lantern: string;
}

export interface HUDState {
  score: number;
  best: number;
  coins: number;
  runCoins: number;
  lives: number;
  combo: number;
  comboFlash: string | null;
  shield: boolean;
  goldenRope: boolean;
  slowMo: boolean;
  speedPct: number;
  themeName: string;
  phase: GamePhase;
  canContinue: boolean;
}
