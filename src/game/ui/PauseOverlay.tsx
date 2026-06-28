export function PauseOverlay({
  onResume,
  onMenu,
}: {
  onResume: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm">
      <div className="font-display text-4xl text-white">Paused</div>
      <button
        onClick={onResume}
        className="rounded-2xl bg-rose-500 px-8 py-3 font-display text-xl text-white shadow-[0_6px_0_0_#9f1239] active:translate-y-[2px] active:shadow-[0_4px_0_0_#9f1239]"
      >
        Resume
      </button>
      <button
        onClick={onMenu}
        className="rounded-xl bg-white/10 px-5 py-2 text-white"
      >
        End Run
      </button>
    </div>
  );
}
