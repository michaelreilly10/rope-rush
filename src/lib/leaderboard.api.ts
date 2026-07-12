import { Capacitor } from "@capacitor/core";
import type { LeaderboardEntry } from "./leaderboard.server";

export type { LeaderboardEntry };

const BASE_URL = import.meta.env.VITE_SERVER_BASE_URL ?? "";

function apiUrl(path: string): string {
  if (Capacitor.isNativePlatform()) {
    const base = BASE_URL.replace(/\/$/, "");
    return `${base}${path}`;
  }
  return path;
}

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(input), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export async function startGameSession(): Promise<{ token: string }> {
  const res = await apiFetch("/api/leaderboard/start", { method: "POST" });
  if (!res.ok) throw new Error("Failed to start session");
  return res.json();
}

export async function getTopScores(): Promise<{ entries: LeaderboardEntry[] }> {
  const res = await apiFetch("/api/leaderboard/scores", { method: "GET" });
  if (!res.ok) throw new Error("Failed to load leaderboard");
  return res.json();
}

export async function submitScore(payload: {
  name: string;
  score: number;
  token: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await apiFetch("/api/leaderboard/scores", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to submit score");
  return res.json();
}

export async function deleteScoreForContinue(payload: {
  id: string;
  token: string;
}): Promise<{ ok: boolean }> {
  const res = await apiFetch("/api/leaderboard/continue", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to delete score");
  return res.json();
}
