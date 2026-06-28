import type { HUDState } from "../types";

export function MainMenu({
  hud,
  onPlay,
  onShop,
  onSettings,
}: {
  hud: HUDState;
  onPlay: () => void;
  onShop: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between bg-gradient-to-b from-black/30 via-black/10 to-black/60 px-6 py-10">
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.4em] text-white/60">A One-Tap Descent</div>
        <h1 className="mt-2 font-display text-6xl leading-none text-white drop-shadow-lg">
          Rope<span className="text-rose-400">Rush</span>
        </h1>
        <div className="mt-4 flex items-center justify-center gap-4 text-white/80">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-white/50">Best</div>
            <div className="font-display text-xl">{hud.best}m</div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-white/50">Coins</div>
            <div className="font-display text-xl text-amber-300">{hud.coins}</div>
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={onPlay}
          className="rounded-2xl bg-rose-500 px-6 py-4 font-display text-2xl text-white shadow-[0_8px_0_0_#9f1239] active:translate-y-[3px] active:shadow-[0_5px_0_0_#9f1239]"
        >
          TAP TO PLAY
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onShop}
            className="rounded-xl bg-white/10 px-4 py-3 font-display text-lg text-white backdrop-blur-sm active:scale-95"
          >
            Shop
          </button>
          <button
            onClick={onSettings}
            className="rounded-xl bg-white/10 px-4 py-3 font-display text-lg text-white backdrop-blur-sm active:scale-95"
          >
            Settings
          </button>
        </div>
        <p className="text-center text-xs text-white/50">
          Tap anywhere in-game to switch sides of the rope.
        </p>
      </div>
    </div>
  );
}
