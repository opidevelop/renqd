create index if not exists drag_race_activity_actor_created_idx
  on public.drag_race_activity(actor_id,created_at desc);
create index if not exists drag_race_results_user_completed_idx
  on public.drag_race_results(user_id,completed_at desc);
create index if not exists drag_race_user_period_leaderboard_idx
  on public.drag_race_user_period_stats(period_type,period_start,mode,franchise_code,best_result desc,best_accuracy desc)
  where games_completed>0;
create index if not exists drag_race_user_stats_rank_idx
  on public.drag_race_user_stats(mode,franchise_code,best_result desc,best_accuracy desc,best_time_seconds)
  where games_completed>0;
comment on table public.drag_race_activity is
  'Internal activity events. Direct table access is intentionally denied; approved social-feed RPC applies profile privacy, follow and block rules.';
