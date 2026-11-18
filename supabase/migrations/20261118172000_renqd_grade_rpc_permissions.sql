revoke all on function public.renqd_complete_grade(uuid,jsonb,jsonb) from public, anon;
revoke all on function public.renqd_update_grade_published(uuid,text,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.renqd_complete_grade(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.renqd_update_grade_published(uuid,text,jsonb,jsonb,jsonb) to authenticated;