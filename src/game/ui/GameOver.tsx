import { useState } from "react";
import type { HUDState } from "../types";

export function GameOver({
  hud,
  onContinue,
  onRetry,
  onHome,
}: {
  hud: HUDState;
  onContinue: () => void;
  onRetry: () => void;
  onHome: () => void;
}) {
  const [showAd, setShowAd] = useState(false);
  const [adProgress, setAdProgress] = useState(0);

  const playAd = () => {
    setShowAd(true);
    setAdProgress(0);
    const start = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / 1800);
      setAdProgress(p);
      if (p < 1) requestAnimationFrame(tick);
      else {
        setShowAd(false);
        onContinue();
      }
    };
    requestAnimationFrame(tick);
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
      {showAd ? (
        <div className="w-full max-w-xs rounded-2xl bg-white p-6 text-center text-black">
          <div className="text-xs uppercase tracking-widest text-black/50">Rewarded Ad</div>
          <div className="mt-3 font-display text-2xl">Watching ad…</div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full bg-rose-500 transition-[width] duration-100"
              style={{ width: `${adProgress * 100}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-black/50">+1 Life when complete</div>
        </div>
      ) : (
        <>
          <div className="text-[10px] uppercase tracking-[0.5em] text-[#ff2e63]">System Down</div>
          <h2
            className="mt-3 font-display text-6xl text-white"
            style={{
              textShadow:
                "0 0 12px rgba(0,217,255,0.9), 0 0 32px rgba(255,46,99,0.5)",
            }}
          >
            {hud.score}<span className="text-2xl text-cyan-200/70">m</span>
          </h2>
          <div className="mt-2 text-xs uppercase tracking-widest text-white/50">
            Best {hud.best}m {hud.score >= hud.best && hud.score > 0 && "· NEW RECORD"}
          </div>

          <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
            {hud.canContinue && (
              <button
                onClick={playAd}
                className="rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-6 py-4 font-display text-xl text-emerald-200 backdrop-blur-md active:scale-[0.98]"
                style={{ textShadow: "0 0 10px rgba(52,211,153,0.9)" }}
              >
                ▶ Continue
              </button>
            )}
            <button
              onClick={onRetry}
              className="rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-6 py-4 font-display text-xl text-cyan-100 backdrop-blur-md active:scale-[0.98]"
              style={{ textShadow: "0 0 10px rgba(0,217,255,0.9)" }}
            >
              Retry
            </button>
          </div>
        </>
      )}
    </div>
  );
}
