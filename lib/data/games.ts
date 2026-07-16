import { createClient } from "@/lib/supabase/client";
import { GAMES, type Game } from "@/app/data/games";

export interface GameWithStats extends Game {
  best: number;
  plays: number;
}

function toFallback(games: Game[]): GameWithStats[] {
  return games.map((g) => ({ ...g, best: 0, plays: 0 }));
}

function deriveStats(scores: { game_id: string; score: number }[]) {
  const byGame = new Map<string, { best: number; plays: number }>();
  for (const row of scores) {
    const current = byGame.get(row.game_id) ?? { best: 0, plays: 0 };
    current.plays += 1;
    current.best = Math.max(current.best, row.score);
    byGame.set(row.game_id, current);
  }
  return byGame;
}

export async function getGames(): Promise<GameWithStats[]> {
  const supabase = createClient();
  try {
    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("*");
    if (gamesError) throw gamesError;

    const { data: scores, error: scoresError } = await supabase
      .from("scores")
      .select("game_id, score");
    if (scoresError) throw scoresError;

    const stats = deriveStats(
      (scores ?? []) as { game_id: string; score: number }[],
    );

    return ((games ?? []) as Game[]).map((g) => {
      const s = stats.get(g.id) ?? { best: 0, plays: 0 };
      return { ...g, ...s };
    });
  } catch {
    return toFallback(GAMES);
  }
}

export async function getGame(id: string): Promise<GameWithStats | null> {
  const supabase = createClient();
  try {
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (gameError) throw gameError;
    if (!game) return null;

    const { data: scores, error: scoresError } = await supabase
      .from("scores")
      .select("score")
      .eq("game_id", id);
    if (scoresError) throw scoresError;

    const rows = (scores ?? []) as { score: number }[];
    const best = rows.reduce((max, s) => Math.max(max, s.score), 0);
    const plays = rows.length;

    return { ...(game as Game), best, plays };
  } catch {
    const fallback = GAMES.find((g) => g.id === id);
    return fallback ? { ...fallback, best: 0, plays: 0 } : null;
  }
}
