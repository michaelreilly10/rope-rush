const KEY = "rope-rush:v1";

export interface SaveData {
  best: number;
  coins: number;
  unlocked: { chars: string[]; ropes: string[]; trails: string[] };
  equipped: { char: string; rope: string; trail: string };
  settings: { sfx: boolean; music: boolean; haptics: boolean };
}

const DEFAULT: SaveData = {
  best: 0,
  coins: 0,
  unlocked: {
    chars: ["classic"],
    ropes: ["rope"],
    trails: ["smoke"],
  },
  equipped: { char: "classic", rope: "rope", trail: "smoke" },
  settings: { sfx: true, music: true, haptics: true },
};

export function loadSave(): SaveData {
  if (typeof localStorage === "undefined") return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT,
      ...parsed,
      unlocked: { ...DEFAULT.unlocked, ...(parsed.unlocked ?? {}) },
      equipped: { ...DEFAULT.equipped, ...(parsed.equipped ?? {}) },
      settings: { ...DEFAULT.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveSave(data: SaveData) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}
