do $$
declare v_definition text;
begin
 select pg_get_functiondef('public.renqd_complete_grade(uuid,jsonb,jsonb)'::regprocedure) into v_definition;
 v_definition:=replace(v_definition,chr(92)||'.','[.]');
 execute v_definition;
 select pg_get_functiondef('public.renqd_update_grade_published(uuid,text,jsonb,jsonb,jsonb)'::regprocedure) into v_definition;
 v_definition:=replace(v_definition,chr(92)||'.','[.]');
 execute v_definition;
end;$$;