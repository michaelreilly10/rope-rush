import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { HUDState } from "../types";
import { submitScore, deleteScoreForContinue } from "@/lib/leaderboard.functions";


const NAME_KEY = "rr.playerName";
const MY_SCORES_KEY = "rr.myScores";
const SUBMITTED_TOKENS_KEY = "rr.submittedTokens";

function readMyScoreIds(): string[] {
  try {
    const raw = localStorage.getItem(MY_SCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function addMyScoreId(id: string) {
  try {
    const ids = new Set(readMyScoreIds());
    ids.add(id);
    localStorage.setItem(MY_SCORES_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

function readSubmittedTokens(): Set<string> {
  try {
    const raw = localStorage.getItem(SUBMITTED_TOKENS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : []);
  } catch {
    return new Set();
  }
}

function hasSubmittedToken(token: string): boolean {
  return readSubmittedTokens().has(token);
}

function markTokenSubmitted(token: string) {
  try {
    const set = readSubmittedTokens();
    set.add(token);
    // Cap size to avoid unbounded growth.
    const arr = Array.from(set).slice(-100);
    localStorage.setItem(SUBMITTED_TOKENS_KEY, JSON.stringify(arr));
  } catch {}
}

function unmarkTokenSubmitted(token: string) {
  try {
    const set = readSubmittedTokens();
    set.delete(token);
    localStorage.setItem(SUBMITTED_TOKENS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

function removeMyScoreId(id: string) {
  try {
    const ids = readMyScoreIds().filter((x) => x !== id);
    localStorage.setItem(MY_SCORES_KEY, JSON.stringify(ids));
  } catch {}
}



export function GameOver({
  hud,
  sessionToken,
  onContinue,
  onRetry,
  onLeaderboard,
}: {
  hud: HUDState;
  sessionToken: string | null;
  onContinue: () => void;
  onRetry: () => void;
  onLeaderboard: (highlightId?: string) => void;
}) {
  const [showAd, setShowAd] = useState(false);
  const [adProgress, setAdProgress] = useState(0);
  const submit = useServerFn(submitScore);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    if (hud.canContinue) return; // wait until the run is truly final
    if (!sessionToken) return;
    if (hasSubmittedToken(sessionToken)) {
      setStatus("done");
      return;
    }
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) {
        setName(saved);
        if (hud.score >= 1 && status === "idle") {
          setStatus("submitting");
          markTokenSubmitted(sessionToken);
          submit({ data: { name: saved, score: hud.score, token: sessionToken } })
            .then((res) => {
              if (res.ok) {
                addMyScoreId(res.id);
                setSubmittedId(res.id);
                setStatus("done");
              } else {
                setStatus("error");
                setError(res.error);
              }
            })
            .catch((e) => {
              setStatus("error");
              setError(String((e as Error)?.message ?? e));
            });
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud.canContinue, sessionToken]);



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

  const doSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || hud.score < 1) return;
    if (!sessionToken) {
      setStatus("error");
      setError("No active session");
      return;
    }
    if (hasSubmittedToken(sessionToken)) {
      setStatus("done");
      return;
    }
    setStatus("submitting");
    setError(null);
    markTokenSubmitted(sessionToken);
    try {
      const res = await submit({ data: { name: trimmed, score: hud.score, token: sessionToken } });
      if (res.ok) {
        try { localStorage.setItem(NAME_KEY, trimmed); } catch {}
        addMyScoreId(res.id);
        setSubmittedId(res.id);
        setStatus("done");
      } else {
        setStatus("error");
        setError(res.error);
      }
    } catch (e) {
      setStatus("error");
      setError(String((e as Error)?.message ?? e));
    }
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
          <div className="text-[10px] uppercase tracking-[0.5em] text-[#ff2e63]">GAME OVER</div>
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

          {hud.score > 0 && !hud.canContinue && status !== "done" && (
            <div className="mt-6 w-full max-w-xs">
              <label className="mb-1 block text-[10px] uppercase tracking-[0.3em] text-cyan-300/70">
                Submit to Leaderboard
              </label>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={16}
                  placeholder="Your name"
                  className="flex-1 rounded-lg border border-cyan-300/30 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/70"
                />
                <button
                  onClick={doSubmit}
                  disabled={status === "submitting" || !name.trim()}
                  className="rounded-lg border border-cyan-300/40 bg-cyan-500/20 px-3 py-2 text-xs font-display uppercase tracking-widest text-cyan-100 backdrop-blur-md active:scale-95 disabled:opacity-40"
                >
                  {status === "submitting" ? "…" : "Submit"}
                </button>
              </div>
              {error && (
                <div className="mt-2 text-[11px] text-rose-300">{error}</div>
              )}
            </div>
          )}
          {status === "done" && (
            <div className="mt-6 text-xs uppercase tracking-widest text-emerald-300">
              ✓ Score submitted
            </div>
          )}

          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
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
            <button
              onClick={() => onLeaderboard(submittedId ?? undefined)}
              className="rounded-xl border border-white/15 bg-black/40 px-6 py-3 font-display text-sm uppercase tracking-widest text-white/80 backdrop-blur-md active:scale-[0.98]"
            >
              View Leaderboard
            </button>
          </div>
        </>
      )}
    </div>
  );
}
