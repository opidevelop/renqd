export type TrackRecordPlacementScore = {
  placement_key: string;
  label: string;
  score: number;
  color: string;
  sort_order: number;
};
export type TrackRecordEpisode = { number: number; title: string; counts_for_ppe?: boolean; mini_challenge?: string | null; maxi_challenge?: string | null; lip_sync_song?: string | null };
export type TrackRecordResult = { episode: number; placement: string | null };
export type TrackRecordQueen = {
  id?: string;
  name: string;
  image_url?: string | null;
  winner?: boolean;
  results: TrackRecordResult[];
  ppe_episode_numbers?: number[];
  elimination_tie_order?: number | null;
};
export type TrackRecordData = {
  franchise_code?: string;
  season_number?: number;
  year?: number | null;
  episodes: TrackRecordEpisode[];
  queens: TrackRecordQueen[];
  custom_placements?: Array<{ placement_key: string; label: string; score: number; color: string }>;
  source_metadata?: { source_id?: string; source_version?: string; source_url?: string; generated_at?: string; placement_mode?: "MANUAL" };
};
const isElimination = (placement: string | null) => {
  if (!placement) return false;
  const value = placement.toUpperCase();
  return value.includes("ELIM") || value.includes("QUIT") || value.includes("DISQ") || value === "DEPT";
};
export function calculateTrackRecordPPE(queen: TrackRecordQueen, episodes: TrackRecordEpisode[], rules: TrackRecordPlacementScore[], custom: TrackRecordData["custom_placements"] = []) {
  const scoreMap = new Map<string, number>();
  for (const rule of rules) scoreMap.set(rule.placement_key, Number(rule.score));
  for (const rule of custom ?? []) scoreMap.set(rule.placement_key, Number(rule.score));
  const eligible = queen.ppe_episode_numbers ?? episodes.filter(ep => ep.counts_for_ppe !== false && !ep.title.toLowerCase().includes("final")).map(ep => ep.number);
  const values = queen.results.filter(result => eligible.includes(result.episode) && result.placement !== null && scoreMap.has(result.placement)).map(result => scoreMap.get(result.placement!)!);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
export function sortTrackRecordQueens(data: TrackRecordData, rules: TrackRecordPlacementScore[]) {
  const scoreMap = new Map<string, number>();
  for (const rule of rules) scoreMap.set(rule.placement_key, Number(rule.score));
  for (const rule of data.custom_placements ?? []) scoreMap.set(rule.placement_key, Number(rule.score));
  const rows = data.queens.map(queen => {
    const eliminationResult = queen.results
      .filter(result => isElimination(result.placement))
      .sort((a, b) => a.episode - b.episode)[0];
    const elimination = eliminationResult?.episode ?? null;
    const eliminationPlacementScore = eliminationResult?.placement ? scoreMap.get(eliminationResult.placement) ?? Number.NEGATIVE_INFINITY : Number.NEGATIVE_INFINITY;
    const bestPlacementScore = queen.results.reduce((best, result) => {
      if (!result.placement) return best;
      return Math.max(best, scoreMap.get(result.placement) ?? Number.NEGATIVE_INFINITY);
    }, Number.NEGATIVE_INFINITY);
    const ppe = calculateTrackRecordPPE(queen, data.episodes, rules, data.custom_placements);
    return { ...queen, ppe, elimination_episode: elimination, eliminated: elimination !== null, best_placement_score: bestPlacementScore, elimination_placement_score: eliminationPlacementScore };
  });
  rows.sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    if (!a.eliminated) {
      const score = (b.ppe ?? -1) - (a.ppe ?? -1);
      if (Math.abs(score) > 0.000001) return score;
      const bestPlacement = b.best_placement_score - a.best_placement_score;
      if (Math.abs(bestPlacement) > 0.000001) return bestPlacement;
      return a.name.localeCompare(b.name);
    }
    return (a.elimination_episode ?? 9999) - (b.elimination_episode ?? 9999)
      || (b.elimination_placement_score - a.elimination_placement_score)
      || (a.elimination_tie_order ?? 9999) - (b.elimination_tie_order ?? 9999)
      || a.name.localeCompare(b.name);
  });
  return rows.map((queen, index) => ({ ...queen, calculated_rank: index + 1 }));
}
