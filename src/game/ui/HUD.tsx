import { Trophy } from "lucide-react";
import type { HUDState } from "../types";

const heart = (filled: boolean, key: number) => (
  <span
    key={key}
    className={filled ? "text-[#ff2e63]" : "text-white/15"}
    style={filled ? { textShadow: "0 0 8px rgba(255,46,99,0.9)" } : undefined}
  >
    ♥
  </span>
);

export function HUD({
  hud,
  onPause,
  onLeaderboard,
}: {
  hud: HUDState;
  onPause: () => void;
  onLeaderboard: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <div className="pointer-events-auto flex items-start justify-between px-4 pt-4">
        <div className="rounded-xl border border-cyan-300/20 bg-black/50 px-3 py-2 text-white backdrop-blur-md">
          <div className="text-[9px] uppercase tracking-[0.3em] text-cyan-300/70">Distance</div>
          <div
            className="font-display text-2xl leading-none"
            style={{ textShadow: "0 0 8px rgba(0,217,255,0.7)" }}
          >
            {hud.score}
            <span className="text-sm text-cyan-200/70">m</span>
          </div>
          <div className="text-[9px] uppercase tracking-widest text-white/40">Best {hud.best}m</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onLeaderboard}
            aria-label="Leaderboard"
            className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/20 bg-black/50 text-cyan-200 backdrop-blur-md active:scale-95"
            style={{ textShadow: "0 0 8px rgba(0,217,255,0.9)" }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 4h10v3a5 5 0 0 1-10 0V4z" />
              <path d="M4 5h3v2a3 3 0 0 1-3-3z" />
              <path d="M20 5h-3v2a3 3 0 0 0 3-3z" />
              <path d="M9 14h6v2H9z" />
              <path d="M8 20h8" />
              <path d="M12 16v4" />
            </svg>
          </button>
          <button
            onClick={onPause}
            aria-label="Pause"
            className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/20 bg-black/50 text-white backdrop-blur-md active:scale-95"
          >
            <span className="flex gap-1">
              <span className="block h-4 w-1 bg-cyan-300" />
              <span className="block h-4 w-1 bg-cyan-300" />
            </span>
          </button>
        </div>
      </div>



      <div className="pointer-events-none flex items-center justify-center pt-3">
        <div className="flex gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-lg backdrop-blur-md">
          {Array.from({ length: 3 }).map((_, i) => heart(i < hud.lives, i))}
        </div>
      </div>

      {hud.combo > 0 && (
        <div className="pointer-events-none mt-2 flex justify-center">
          <div className="rounded-full border border-cyan-300/30 bg-black/50 px-3 py-1 text-white backdrop-blur-md">
            <span
              className="font-display text-lg"
              style={{ textShadow: "0 0 8px rgba(0,217,255,0.8)" }}
            >
              ×{hud.combo}
            </span>
            <span className="ml-1 text-[9px] uppercase tracking-widest text-cyan-200/70">combo</span>
          </div>
        </div>
      )}

      {hud.comboFlash && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
          <div
            className="animate-[fade-in_0.3s_ease-out] rounded-full border border-cyan-300/40 bg-black/70 px-5 py-2 font-display text-2xl text-cyan-200"
            style={{ textShadow: "0 0 12px rgba(0,217,255,0.9)" }}
          >
            {hud.comboFlash}
          </div>
        </div>
      )}
    </div>
  );
}
