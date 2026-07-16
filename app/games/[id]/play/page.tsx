"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { GAMES } from "@/app/data";
import { insertScore } from "@/lib/data/scores";
import { useUser } from "@/app/context/UserContext";
import {
  AsteroidsCanvas,
  type AsteroidsCanvasHandle,
} from "@/components/games/AsteroidsCanvas";

export default function GamePlayer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const game = GAMES.find((g) => g.id === id);
  const isAsteroides = id === "asteroides";
  const { user } = useUser();

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(user ?? "INVITADO");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const canvasRef = useRef<AsteroidsCanvasHandle>(null);
  const savedOnceRef = useRef(false);

  if (!game) notFound();

  useEffect(() => {
    if (isAsteroides) return;
    if (over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [isAsteroides, over, paused]);

  useEffect(() => {
    if (isAsteroides) return;
    if (score > 0 && score % 2500 < 100) setLevel((l) => l + 1);
  }, [isAsteroides, score]);

  function restart() {
    setScore(0);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setName(user ?? "INVITADO");
  }

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button
            className="btn magenta"
            onClick={() => {
              if (isAsteroides) {
                setPaused(false);
                canvasRef.current?.forceGameOver();
              } else {
                setOver(true);
              }
            }}
          >
            FIN
          </button>
          <Link href={`/games/${id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {isAsteroides ? (
            <AsteroidsCanvas
              ref={canvasRef}
              paused={paused}
              onScoreChange={setScore}
              onLivesChange={setLives}
              onLevelChange={setLevel}
              onGameOver={(finalScore) => {
                setOver(true);
                setSaved(false);
                setSaveError(false);
                if (savedOnceRef.current) return;
                savedOnceRef.current = true;
                insertScore("asteroides", user ?? "ANÓNIMO", finalScore)
                  .then(() => setSaved(true))
                  .catch(() => {
                    savedOnceRef.current = false;
                    setSaveError(true);
                  });
              }}
              onRestart={() => {
                setOver(false);
                setSaved(false);
                setSaveError(false);
                setName(user ?? "INVITADO");
                savedOnceRef.current = false;
              }}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor" />
              <div className="enemy e1" />
              <div className="enemy e2" />
              <div className="enemy e3" />
              <div className="player-ship" />
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {isAsteroides ? (
              saveError ? (
                <div className="toast-saved">
                  ▸ ERROR AL GUARDAR LA PUNTUACIÓN_
                </div>
              ) : saved ? (
                <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
              ) : (
                <div className="toast-saved">▸ GUARDANDO PUNTUACIÓN…</div>
              )
            ) : !saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button className="btn yellow" onClick={() => setSaved(true)}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button
                className="btn"
                onClick={() =>
                  isAsteroides ? canvasRef.current?.reset() : restart()
                }
              >
                JUGAR DE NUEVO
              </button>
              <Link href="/games" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
