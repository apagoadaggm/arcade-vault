"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  SnakeEngine,
  type SnakeEngineCallbacks,
} from "@/lib/games/snake/engine";

const WIDTH = 800;
const HEIGHT = 600;

export interface SnakeCanvasProps extends SnakeEngineCallbacks {
  paused: boolean;
}

export interface SnakeCanvasHandle {
  reset: () => void;
  forceGameOver: () => void;
}

export const SnakeCanvas = forwardRef<SnakeCanvasHandle, SnakeCanvasProps>(
  function SnakeCanvas(
    { paused, onScoreChange, onLevelChange, onGameOver, onRestart },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<SnakeEngine | null>(null);
    const pausedRef = useRef(paused);
    pausedRef.current = paused;

    const callbacksRef = useRef<SnakeEngineCallbacks>({});
    callbacksRef.current = {
      onScoreChange,
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

      let cancelled = false;
      let frameId: number;

      const fruitImage = new Image();
      fruitImage.onload = () => {
        if (cancelled) return;

        const engine = new SnakeEngine(
          ctx,
          WIDTH,
          HEIGHT,
          {
            onScoreChange: (score) =>
              callbacksRef.current.onScoreChange?.(score),
            onLevelChange: (level) =>
              callbacksRef.current.onLevelChange?.(level),
            onGameOver: (finalScore) =>
              callbacksRef.current.onGameOver?.(finalScore),
            onRestart: () => callbacksRef.current.onRestart?.(),
          },
          fruitImage,
        );
        engineRef.current = engine;

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
      };
      fruitImage.src = "/games/snake/fruits.png";

      return () => {
        cancelled = true;
        cancelAnimationFrame(frameId);
        engineRef.current?.destroy();
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
  },
);
