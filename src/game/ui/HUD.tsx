import type { HUDState } from "../types";

const heart = (filled: boolean, key: number) => (
  <span key={key} className={filled ? "text-rose-400" : "text-white/20"}>♥</span>
);

export function HUD({ hud, onPause }: { hud: HUDState; onPause: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <div className="pointer-events-auto flex items-start justify-between px-4 pt-3">
        <div className="rounded-2xl bg-black/40 px-3 py-2 text-white backdrop-blur-sm">
          <div className="text-[10px] uppercase tracking-widest text-white/60">Distance</div>
          <div className="font-display text-2xl leading-none">{hud.score}m</div>
          <div className="text-[10px] text-white/60">Best {hud.best}m</div>
        </div>

        <button
          onClick={onPause}
          aria-label="Pause"
          className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm active:scale-95"
        >
          <span className="block h-4 w-1 bg-white" />
          <span className="-mt-4 ml-2 block h-4 w-1 bg-white" />
        </button>
      </div>

      <div className="pointer-events-none flex items-center justify-center pt-2">
        <div className="flex gap-1 rounded-full bg-black/40 px-3 py-1 text-lg backdrop-blur-sm">
          {Array.from({ length: 3 }).map((_, i) => heart(i < hud.lives, i))}
        </div>
      </div>

      {hud.combo > 0 && (
        <div className="pointer-events-none mt-2 flex justify-center">
          <div className="rounded-full bg-black/40 px-3 py-1 text-white backdrop-blur-sm">
            <span className="font-display text-lg">×{hud.combo}</span>
            <span className="ml-1 text-[10px] uppercase tracking-widest text-white/60">combo</span>
          </div>
        </div>
      )}

      {hud.comboFlash && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
          <div className="animate-[fade-in_0.3s_ease-out] rounded-full bg-amber-400/90 px-5 py-2 font-display text-2xl text-black shadow-lg">
            {hud.comboFlash}
          </div>
        </div>
      )}

      {/* status icons */}
      <div className="pointer-events-none mt-2 flex justify-center gap-2 text-xs">
        {hud.shield && <span className="rounded-full bg-cyan-500/80 px-2 py-0.5 text-white">SHIELD</span>}
        {hud.slowMo && <span className="rounded-full bg-purple-500/80 px-2 py-0.5 text-white">SLOW-MO</span>}
        {hud.goldenRope && <span className="rounded-full bg-amber-500/80 px-2 py-0.5 text-black">GOLDEN</span>}
      </div>
    </div>
  );
}
