import { Music, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { audio, type MusicVibe } from "../audio";

const VIBES: { id: MusicVibe; label: string }[] = [
  { id: "calm", label: "Calm" },
  { id: "tense", label: "Tense" },
  { id: "arcade", label: "Arcade" },
  { id: "cinematic", label: "Cinematic" },
  { id: "dark", label: "Dark" },
];

export function PauseOverlay({
  onResume,
  onMenu,
  muted,
  onToggleMute,
}: {
  onResume: () => void;
  onMenu: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const [vibe, setVibe] = useState<MusicVibe>(() => audio.getVibe());
  const [musicOpen, setMusicOpen] = useState(false);

  const pick = (v: MusicVibe) => {
    audio.setVibe(v);
    setVibe(v);
  };

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
        onClick={() => setMusicOpen((o) => !o)}
        aria-label="Music options"
        aria-expanded={musicOpen}
        className={
          "flex items-center gap-2 rounded-full px-5 py-2 text-white transition active:scale-95 " +
          (musicOpen ? "bg-white/25" : "bg-white/10 hover:bg-white/20")
        }
      >
        <Music size={18} />
        <span className="text-sm">Music</span>
      </button>

      {musicOpen && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/5 px-5 py-4 backdrop-blur-sm">
          <button
            onClick={onToggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2 text-white active:scale-95"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            <span className="text-sm">{muted ? "Muted" : "Sound"}</span>
          </button>

          <div className="flex flex-col items-center gap-2">
            <div className="text-xs uppercase tracking-widest text-white/60">Vibe</div>
            <div className="flex flex-wrap justify-center gap-1.5 max-w-[280px]">
              {VIBES.map((v) => {
                const active = v.id === vibe;
                return (
                  <button
                    key={v.id}
                    onClick={() => pick(v.id)}
                    className={
                      "rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 " +
                      (active
                        ? "bg-white text-black shadow"
                        : "bg-white/10 text-white hover:bg-white/20")
                    }
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onMenu}
        className="rounded-xl bg-white/10 px-5 py-2 text-white"
      >
        End Run
      </button>
    </div>
  );
}
