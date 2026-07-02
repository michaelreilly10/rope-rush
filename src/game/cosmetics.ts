export interface CharSkin {
  id: string;
  name: string;
  price: number;
  body: string; // outfit color
  sash: string;
  trim: string;
}

export interface RopeSkin {
  id: string;
  name: string;
  price: number;
  color: string;
  glow?: string;
  style: "rope" | "chain" | "vine" | "neon";
}

export interface TrailSkin {
  id: string;
  name: string;
  price: number;
  color: string;
  kind: "smoke" | "fire" | "ice" | "leaves" | "petals" | "lightning" | "shadow";
}

export const CHARACTERS: CharSkin[] = [
  { id: "classic", name: "Cyber Ninja", price: 0, body: "#0f1230", sash: "#ff2e63", trim: "#00d9ff" },
  { id: "samurai", name: "Samurai", price: 250, body: "#2a2236", sash: "#d4a64a", trim: "#e8d9a8" },
  { id: "shadow", name: "Shadow Assassin", price: 600, body: "#0b0b12", sash: "#6b3df0", trim: "#9a8ec9" },
  { id: "robot", name: "Robot Ninja", price: 1200, body: "#3a4350", sash: "#39d6c4", trim: "#c9d2dc" },
  { id: "ghost", name: "Ghost Ninja", price: 2000, body: "#dfeaf3", sash: "#7fa8ce", trim: "#ffffff" },
  { id: "fire", name: "Fire Ninja", price: 3500, body: "#2c0f0a", sash: "#ff7a1a", trim: "#ffd07a" },
  { id: "frog", name: "Frog Ninja", price: 5000, body: "#2e6b3a", sash: "#f0e6c0", trim: "#a8d77a" },
];

export const ROPES: RopeSkin[] = [
  { id: "rope", name: "Neon Cable", price: 0, color: "#00d9ff", glow: "#00d9ff", style: "neon" },
  { id: "chain", name: "Iron Chain", price: 400, color: "#9aa3ad", style: "chain" },
  { id: "vine", name: "Jungle Vine", price: 800, color: "#5b8a3a", style: "vine" },
  { id: "neon", name: "Magenta Pulse", price: 2500, color: "#ff2e63", glow: "#ff2e63", style: "neon" },
];

export const TRAILS: TrailSkin[] = [
  { id: "smoke", name: "Smoke", price: 0, color: "#c8c2b6", kind: "smoke" },
  { id: "fire", name: "Fire", price: 300, color: "#ff7a1a", kind: "fire" },
  { id: "ice", name: "Ice", price: 600, color: "#9fdcff", kind: "ice" },
  { id: "petals", name: "Cherry Blossoms", price: 1000, color: "#ffb3cf", kind: "petals" },
  { id: "lightning", name: "Lightning", price: 2000, color: "#fff48a", kind: "lightning" },
  { id: "shadow", name: "Shadow Aura", price: 3500, color: "#6b3df0", kind: "shadow" },
];

export const findChar = (id: string) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
export const findRope = (id: string) => ROPES.find((r) => r.id === id) ?? ROPES[0];
export const findTrail = (id: string) => TRAILS.find((t) => t.id === id) ?? TRAILS[0];
