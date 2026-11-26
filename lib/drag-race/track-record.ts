export type TrackRecordPlacementScore = {
  placement_key: string;
  label: string;
  score: number;
  color: string;
  sort_order: number;
};
export type TrackRecordEpisode = { number: number; title: string; counts_for_ppe?: boolean };
export type TrackRecordEpisodeFacts = { mini_challenge_winner?: boolean; maxi_challenge_winner?: boolean; listed_top?: boolean; listed_bottom?: boolean; lipsync_participant?: boolean; lipsync_winner?: boolean; lipsync_eliminated?: boolean; eliminated_this_episode?: boolean };
export type TrackRecordResult = { episode: number; placement: string | null; facts?: TrackRecordEpisodeFacts };
export type TrackRecordQueen = {
  id?: string;
  name: string;
  image_url?: string | null;
  rank?: string | null;
  results: TrackRecordResult[];
  ppe_episode_numbers?: number[];
  elimination_episode?: number | null;
  elimination_tie_order?: number | null;
};
export type TrackRecordData = {
  franchise_code?: string;
  season_number?: number;
  year?: number | null;
  episodes: TrackRecordEpisode[];
  queens: TrackRecordQueen[];
  custom_placements?: Array<{ placement_key: string; label: string; score: number; color: string }>;
  source_metadata?: { source_id?: string; source_version?: string; source_url?: string; placement_completeness?: string; placement_note?: string };
};
const rankNumber = (value?: string | null) => {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
};
const isElimination = (placement: string | null) => {
  if (!placement) return false;
  const value = placement.toUpperCase();
  return value.includes("ELIM") || value.includes("QUIT") || value.includes("DISQ") || value.includes("OUT") || value === "DEPT";
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
  const custom = data.custom_placements ?? [];
  const rows = data.queens.map(queen => {
    const elimination = queen.elimination_episode ?? queen.results.find(result => isElimination(result.placement))?.episode ?? null;
    const ppe = calculateTrackRecordPPE(queen, data.episodes, rules, custom);
    return { ...queen, ppe, elimination_episode: elimination, eliminated: elimination !== null };
  });
  rows.sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    if (!a.eliminated) {
      const score = (b.ppe ?? -1) - (a.ppe ?? -1);
      if (Math.abs(score) > 0.000001) return score;
      return rankNumber(a.rank) - rankNumber(b.rank) || a.name.localeCompare(b.name);
    }
    return (a.elimination_episode ?? 9999) - (b.elimination_episode ?? 9999)
      || (a.elimination_tie_order ?? rankNumber(a.rank)) - (b.elimination_tie_order ?? rankNumber(b.rank))
      || a.name.localeCompare(b.name);
  });
  return rows.map((queen, index) => ({ ...queen, calculated_rank: index + 1 }));
}
