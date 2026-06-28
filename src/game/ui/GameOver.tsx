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
          <div className="text-xs uppercase tracking-[0.4em] text-white/60">Game Over</div>
          <h2 className="mt-2 font-display text-5xl text-white">{hud.score}m</h2>
          <div className="mt-2 text-sm text-white/60">
            Best {hud.best}m {hud.score >= hud.best && hud.score > 0 && "· NEW BEST!"}
          </div>
          <div className="mt-2 text-amber-300">+{hud.runCoins} coins</div>

          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            {hud.canContinue && (
              <button
                onClick={playAd}
                className="rounded-2xl bg-emerald-500 px-6 py-4 font-display text-xl text-white shadow-[0_6px_0_0_#065f46] active:translate-y-[2px] active:shadow-[0_4px_0_0_#065f46]"
              >
                ▶ Continue (Watch Ad)
              </button>
            )}
            <button
              onClick={onRetry}
              className="rounded-2xl bg-rose-500 px-6 py-4 font-display text-xl text-white shadow-[0_6px_0_0_#9f1239] active:translate-y-[2px] active:shadow-[0_4px_0_0_#9f1239]"
            >
              Retry
            </button>
            <button
              onClick={onHome}
              className="rounded-xl bg-white/10 px-4 py-3 font-display text-lg text-white"
            >
              Home
            </button>
          </div>
        </>
      )}
    </div>
  );
}
