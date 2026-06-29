import { useEffect, useRef, useState } from "react";
import { Game } from "./engine";
import type { HUDState } from "./types";
import { HUD } from "./ui/HUD";
import { GameOver } from "./ui/GameOver";
import { PauseOverlay } from "./ui/PauseOverlay";

export function RopeRush() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HUDState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game();
    gameRef.current = game;
    game.attach(canvas);
    const unsub = game.subscribe(setHud);
    const onResize = () => game.resize();
    window.addEventListener("resize", onResize);
    // Skip menu — jump straight into a run.
    game.startRun();
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
          {hud.phase === "playing" && <HUD hud={hud} onPause={() => game.pause()} />}
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
              onHome={() => game.startRun()}
            />
          )}
        </>
      )}
    </div>
  );
}
