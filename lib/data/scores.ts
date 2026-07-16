import { createClient } from "@/lib/supabase/client";

export interface Score {
  id: string;
  game_id: string;
  player_name: string;
  score: number;
  created_at: string;
}

export async function getScores(gameId: string, limit = 12): Promise<Score[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Score[];
}

export async function getPlayerBest(
  gameId: string,
  name: string,
): Promise<number | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("score")
    .eq("game_id", gameId)
    .eq("player_name", name)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as { score: number }).score : null;
}

export async function insertScore(
  gameId: string,
  name: string,
  score: number,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("scores")
    .insert({ game_id: gameId, player_name: name, score });
  if (error) throw error;
}
