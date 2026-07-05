import { useEffect, useRef, useState } from "react";
import { Game } from "./engine";
import type { HUDState } from "./types";
import { HUD } from "./ui/HUD";
import { GameOver } from "./ui/GameOver";
import { PauseOverlay } from "./ui/PauseOverlay";
import { Leaderboard } from "./ui/Leaderboard";


export function RopeRush() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HUDState | null>(null);
  const [lbOpen, setLbOpen] = useState(false);
  const [lbHighlight, setLbHighlight] = useState<string | null>(null);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game();
    gameRef.current = game;
    game.attach(canvas);
    const unsub = game.subscribe(setHud);
    const onResize = () => game.resize();
    window.addEventListener("resize", onResize);
    // Stay on menu until first tap.

    return () => {
      unsub();
      window.removeEventListener("resize", onResize);
      game.detach();
    };
  }, []);

  const game = gameRef.current;

  const handlePointer = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!game) return;
    if (hud?.phase === "playing") game.tap();
    else if (hud?.phase === "menu") game.startRun();
  };

  return (
    <div
      className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden bg-black select-none touch-none"
      style={{ fontFamily: "var(--rr-font-body)" }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointer}
        className="absolute inset-0 h-full w-full"
      />

      {hud && game && (
        <>
          {hud.phase === "menu" && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black/30 via-black/50 to-black/80">
              <div className="text-[10px] uppercase tracking-[0.5em] text-cyan-300/80">One-Tap Descent</div>
              <h1
                className="mt-3 font-display text-5xl leading-none text-white"
                style={{
                  textShadow:
                    "0 0 12px rgba(0,217,255,0.9), 0 0 32px rgba(0,217,255,0.55), 0 0 60px rgba(255,46,99,0.35)",
                }}
              >
                ROPE<span className="text-[#ff2e63]">RUSH</span>
              </h1>
              {hud.best > 0 && (
                <div className="mt-4 rounded-full border border-cyan-300/30 bg-black/40 px-4 py-1 text-xs uppercase tracking-widest text-cyan-200/80">
                  Best · {hud.best}m
                </div>
              )}
              <div
                className="mt-10 animate-pulse font-display text-2xl tracking-widest text-white"
                style={{ textShadow: "0 0 10px rgba(0,217,255,0.9)" }}
              >
                TAP TO START
              </div>
              <div className="mt-3 text-[11px] uppercase tracking-widest text-white/40">
                Tap to switch sides · Dodge everything
              </div>
            </div>
          )}
          {hud.phase === "playing" && (
            <HUD
              hud={hud}
              onPause={() => game.pause()}
              onLeaderboard={() => { game.pause(); setLbHighlight(null); setLbOpen(true); }}
            />
          )}
          {hud.phase === "paused" && (
            <PauseOverlay
              onResume={() => game.resumePlay()}
              onMenu={() => { game.endRun(); game.startRun(); }}
            />
          )}
          {hud.phase === "gameover" && (
            <GameOver
              hud={hud}
              onContinue={() => game.continueWithAd()}
              onRetry={() => game.startRun()}
              onLeaderboard={(id) => { setLbHighlight(id ?? null); setLbOpen(true); }}
            />
          )}
          <Leaderboard
            open={lbOpen}
            onClose={() => setLbOpen(false)}
            highlightId={lbHighlight}
          />
        </>
      )}

    </div>
  );
}
