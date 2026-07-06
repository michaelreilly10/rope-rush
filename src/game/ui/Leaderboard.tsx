import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getTopScores, type LeaderboardEntry } from "@/lib/leaderboard.functions";

const MY_SCORES_KEY = "rr.myScores";

function readMyScoreIds(): Set<string> {
  try {
    const raw = localStorage.getItem(MY_SCORES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function Leaderboard({
  open,
  onClose,
  highlightId,
}: {
  open: boolean;
  onClose: () => void;
  highlightId?: string | null;
}) {
  const fetchTop = useServerFn(getTopScores);
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [myIds, setMyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setEntries(null);
    setErr(null);
    setMyIds(readMyScoreIds());
    fetchTop()
      .then((res) => {
        if (!cancelled) setEntries(res.entries);
      })
      .catch((e) => {
        if (!cancelled) setErr(String(e?.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, [open, fetchTop]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/85 px-5 pb-6 pt-5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.5em] text-cyan-300/70">
            Top 100
          </div>
          <h2
            className="font-display text-3xl text-white"
            style={{ textShadow: "0 0 12px rgba(0,217,255,0.9)" }}
          >
            LEADER<span className="text-[#ff2e63]">BOARD</span>
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close leaderboard"
          className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/30 bg-black/60 text-cyan-100 backdrop-blur-md active:scale-95"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto rounded-2xl border border-cyan-300/15 bg-black/40">
        {entries === null && !err && (
          <div className="py-10 text-center text-xs uppercase tracking-widest text-cyan-200/60">
            Loading…
          </div>
        )}
        {err && (
          <div className="py-10 text-center text-xs text-rose-300">
            Couldn't load the leaderboard.
          </div>
        )}
        {entries && entries.length === 0 && (
          <div className="py-10 text-center text-xs uppercase tracking-widest text-white/40">
            No scores yet — be the first.
          </div>
        )}
        {entries && entries.length > 0 && (
          <ol className="divide-y divide-white/5">
            {entries.map((e, i) => {
              const isMine = highlightId === e.id;
              return (
                <li
                  key={e.id}
                  className={`flex items-center gap-3 px-4 py-2 text-sm ${
                    isMine ? "bg-cyan-500/10" : ""
                  }`}
                >
                  <span
                    className={`w-8 font-display text-base ${
                      i === 0
                        ? "text-yellow-300"
                        : i === 1
                        ? "text-slate-200"
                        : i === 2
                        ? "text-amber-500"
                        : "text-white/40"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`flex-1 truncate ${
                      isMine ? "text-cyan-100" : "text-white/85"
                    }`}
                  >
                    {e.name}
                  </span>
                  <span
                    className="font-display text-base text-cyan-200"
                    style={{ textShadow: "0 0 8px rgba(0,217,255,0.6)" }}
                  >
                    {e.score}
                    <span className="ml-0.5 text-xs text-cyan-200/60">m</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
