"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useEffect, useState } from "react";
import { getGame, type GameWithStats } from "@/lib/data/games";
import { getScores, type Score } from "@/lib/data/scores";

export default function GameDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [game, setGame] = useState<GameWithStats | null | undefined>(undefined);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getGame(id), getScores(id, 10)])
      .then(([g, s]) => {
        setGame(g);
        setScores(s);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || game === undefined) {
    return <div className="av-detail fade-in">CARGANDO…</div>;
  }

  if (!game) notFound();

  return (
    <div className="av-detail fade-in">
      <div>
        <Link href={`/games/${id}/play`} className="detail-cover">
          <div className={`cover-bg ${game.cover}`} />
        </Link>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{game.plays}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{
                  color: "var(--magenta)",
                  textShadow: "0 0 6px rgba(255,0,110,0.5)",
                }}
              >
                {game.best.toLocaleString("es-ES")}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link href={`/games/${id}/play`} className="btn xl pulse">
              ▶ JUGAR AHORA
            </Link>
            <Link href="/games" className="btn ghost lg">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {scores.length === 0 && (
            <div style={{ color: "var(--ink-faint)", padding: "24px 0" }}>
              SIN REGISTROS TODAVÍA
            </div>
          )}
          {scores.map((r, i) => (
            <div
              key={r.id}
              className={`lb-row ${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : ""}`.trim()}
            >
              <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
              <div className="pl">
                {r.player_name}
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--ink-faint)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {new Date(r.created_at).toLocaleDateString("es-ES")}
                </div>
              </div>
              <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
