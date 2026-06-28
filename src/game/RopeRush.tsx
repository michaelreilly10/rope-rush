import { useEffect, useRef, useState } from "react";
import { Game } from "./engine";
import type { HUDState } from "./types";
import { HUD } from "./ui/HUD";
import { MainMenu } from "./ui/MainMenu";
import { GameOver } from "./ui/GameOver";
import { PauseOverlay } from "./ui/PauseOverlay";
import { Shop } from "./ui/Shop";
import { SettingsPanel } from "./ui/SettingsPanel";

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
          {hud.phase === "menu" && (
            <MainMenu
              hud={hud}
              onPlay={() => game.startRun()}
              onShop={() => game.goShop()}
              onSettings={() => game.goSettings()}
            />
          )}
          {hud.phase === "paused" && (
            <PauseOverlay
              onResume={() => game.resumePlay()}
              onMenu={() => { game.endRun(); game.goMenu(); }}
            />
          )}
          {hud.phase === "gameover" && (
            <GameOver
              hud={hud}
              onContinue={() => game.continueWithAd()}
              onRetry={() => game.startRun()}
              onHome={() => game.goMenu()}
            />
          )}
          {hud.phase === "shop" && (
            <Shop game={game} onBack={() => game.goMenu()} />
          )}
          {hud.phase === "settings" && (
            <SettingsPanel game={game} onBack={() => game.goMenu()} />
          )}
        </>
      )}
    </div>
  );
}
