"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGames, type GameWithStats } from "@/lib/data/games";
import { getScores, getPlayerBest, type Score } from "@/lib/data/scores";
import { useUser } from "@/app/context/UserContext";

export default function HallOfFame() {
  const { user } = useUser();
  const [games, setGames] = useState<GameWithStats[]>([]);
  const [tab, setTab] = useState<string | null>(null);
  const [rows, setRows] = useState<Score[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [youBest, setYouBest] = useState<number | null>(null);

  useEffect(() => {
    getGames().then((gs) => {
      setGames(gs);
      setTab((prev) => prev ?? gs[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!tab) return;
    setLoadingRows(true);
    getScores(tab, 12)
      .then(setRows)
      .finally(() => setLoadingRows(false));
  }, [tab]);

  useEffect(() => {
    if (!tab || !user) {
      setYouBest(null);
      return;
    }
    getPlayerBest(tab, user).then(setYouBest);
  }, [tab, user]);

  const game = games.find((g) => g.id === tab);
  const youRow = user ? rows.find((r) => r.player_name === user) : undefined;
  const youRank = youRow ? rows.indexOf(youRow) + 1 : null;
  const hasPodium = rows.length >= 3;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={`chip ${tab === g.id ? "active" : ""}`.trim()}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {loadingRows && (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: "var(--ink-faint)",
          }}
        >
          CARGANDO…
        </div>
      )}

      {!loadingRows && !hasPodium && (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: "var(--ink-faint)",
          }}
        >
          <div
            className="pixel"
            style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}
          >
            SIN REGISTROS TODAVÍA
          </div>
          <div>Sé el primero en aparecer en este ranking.</div>
        </div>
      )}

      {!loadingRows && hasPodium && (
        <>
          <div className="podium">
            <div className="podium-slot silver">
              <div className="rank-num">02</div>
              <div className="name">{rows[1].player_name}</div>
              <div className="score">
                {rows[1].score.toLocaleString("es-ES")}
              </div>
              <div className="date">
                {new Date(rows[1].created_at).toLocaleDateString("es-ES")}
              </div>
            </div>
            <div className="podium-slot gold">
              <div
                className="pixel"
                style={{
                  fontSize: 9,
                  color: "var(--gold)",
                  letterSpacing: "0.18em",
                }}
              >
                CAMPEÓN
              </div>
              <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
                01
              </div>
              <div className="name">{rows[0].player_name}</div>
              <div className="score" style={{ fontSize: 20 }}>
                {rows[0].score.toLocaleString("es-ES")}
              </div>
              <div className="date">
                {new Date(rows[0].created_at).toLocaleDateString("es-ES")}
              </div>
            </div>
            <div className="podium-slot bronze">
              <div className="rank-num">03</div>
              <div className="name">{rows[2].player_name}</div>
              <div className="score">
                {rows[2].score.toLocaleString("es-ES")}
              </div>
              <div className="date">
                {new Date(rows[2].created_at).toLocaleDateString("es-ES")}
              </div>
            </div>
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.id}
                className={`tr ${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : ""}`.trim()}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                <div className="pl">{r.player_name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">
                  {new Date(r.created_at).toLocaleDateString("es-ES")}
                </div>
              </div>
            ))}
            {user && youBest !== null && (
              <>
                <div className="tr you-label">
                  ▸ TU MEJOR MARCA EN {game?.title ?? tab}
                </div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    {youRank ? `#${String(youRank).padStart(2, "0")}` : "—"}
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {user}
                  </div>
                  <div
                    className="sc"
                    style={{
                      color: "var(--yellow)",
                      textShadow: "0 0 6px rgba(245,255,0,0.5)",
                    }}
                  >
                    {youBest.toLocaleString("es-ES")}
                  </div>
                  <div className="dt">
                    {youRow
                      ? new Date(youRow.created_at).toLocaleDateString("es-ES")
                      : "—"}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/games" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
