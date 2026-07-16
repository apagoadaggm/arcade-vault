"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  AsteroidsEngine,
  type AsteroidsEngineCallbacks,
} from "@/lib/games/asteroids/engine";

const WIDTH = 800;
const HEIGHT = 600;

export interface AsteroidsCanvasProps extends AsteroidsEngineCallbacks {
  paused: boolean;
}

export interface AsteroidsCanvasHandle {
  reset: () => void;
  forceGameOver: () => void;
}

export const AsteroidsCanvas = forwardRef<
  AsteroidsCanvasHandle,
  AsteroidsCanvasProps
>(function AsteroidsCanvas(
  {
    paused,
    onScoreChange,
    onLivesChange,
    onLevelChange,
    onGameOver,
    onRestart,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const callbacksRef = useRef<AsteroidsEngineCallbacks>({});
  callbacksRef.current = {
    onScoreChange,
    onLivesChange,
    onLevelChange,
    onGameOver,
    onRestart,
  };

  useImperativeHandle(
    ref,
    () => ({
      reset: () => engineRef.current?.reset(),
      forceGameOver: () => engineRef.current?.forceGameOver(),
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const engine = new AsteroidsEngine(ctx, WIDTH, HEIGHT, {
      onScoreChange: (score) => callbacksRef.current.onScoreChange?.(score),
      onLivesChange: (lives) => callbacksRef.current.onLivesChange?.(lives),
      onLevelChange: (level) => callbacksRef.current.onLevelChange?.(level),
      onGameOver: (finalScore) => callbacksRef.current.onGameOver?.(finalScore),
      onRestart: () => callbacksRef.current.onRestart?.(),
    });
    engineRef.current = engine;

    let frameId: number;
    let lastTime: number | null = null;

    function loop(ts: number) {
      if (pausedRef.current) {
        lastTime = null;
      } else {
        const dt =
          lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
        lastTime = ts;
        engine.update(dt);
        engine.draw();
      }
      frameId = requestAnimationFrame(loop);
    }
    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
});
