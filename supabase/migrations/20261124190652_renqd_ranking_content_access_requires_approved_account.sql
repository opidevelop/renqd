CREATE OR REPLACE FUNCTION private.can_access_ranking_content(p_ranking_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  select exists (
    select 1 from public.rankings r
    where r.id=p_ranking_id
      and (
        private.is_moderation_staff()
        or (
          private.is_approved_user()
          and r.hidden_at is null
          and (
            r.deleted_at is null
            or (r.user_id=(select auth.uid()) and r.deleted_by=(select auth.uid()))
          )
          and not private.is_user_blocked_with(r.user_id)
        )
      )
  );
$function$
;
