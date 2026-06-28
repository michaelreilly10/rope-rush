import { useState } from "react";
import type { Game } from "../engine";

export function SettingsPanel({ game, onBack }: { game: Game; onBack: () => void }) {
  const [, force] = useState(0);
  const s = game.save.settings;
  const toggle = (k: "sfx" | "music" | "haptics") => {
    game.setSetting(k, !s[k]);
    force((n) => n + 1);
  };
  const row = (label: string, on: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-left"
    >
      <span className="text-white">{label}</span>
      <span className={`rounded-full px-3 py-1 text-xs ${on ? "bg-emerald-500 text-white" : "bg-white/20 text-white/70"}`}>
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );

  return (
    <div className="absolute inset-0 flex flex-col bg-gradient-to-b from-zinc-900 to-black text-white">
      <div className="flex items-center justify-between px-4 pt-4">
        <button onClick={onBack} className="rounded-full bg-white/10 px-3 py-1.5 text-sm">← Back</button>
        <div className="font-display text-2xl">Settings</div>
        <div className="w-16" />
      </div>
      <div className="mt-6 flex flex-col gap-3 px-6">
        {row("Sound Effects", s.sfx, () => toggle("sfx"))}
        {row("Music", s.music, () => toggle("music"))}
        {row("Haptics", s.haptics, () => toggle("haptics"))}
      </div>
      <div className="mt-auto px-6 pb-8 text-center text-xs text-white/40">
        Rope Rush · Tap to switch sides · Survive the descent
      </div>
    </div>
  );
}
