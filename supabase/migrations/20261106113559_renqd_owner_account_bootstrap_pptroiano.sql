do $$
declare
  v_user_id uuid := 'e646f2ff-a98e-4c7b-a8ff-b7dcfafe4959';
  v_email text;
  v_confirmed_at timestamptz;
  v_owner_count integer;
begin
  select email, email_confirmed_at into v_email, v_confirmed_at
  from auth.users where id = v_user_id;

  if v_email is null or lower(v_email) <> lower('pptroiano@gmail.com') then
    raise exception 'Expected Auth user pptroiano@gmail.com was not found';
  end if;
  if v_confirmed_at is null then
    raise exception 'Email must be verified before OWNER bootstrap';
  end if;

  select count(*) into v_owner_count from public.profiles where role = 'OWNER';
  if v_owner_count <> 0 then
    raise exception 'OWNER already exists; refusing bootstrap';
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower('pptroiano')) then
    raise exception 'Username pptroiano is already in use';
  end if;

  insert into public.profiles (id, email, username, role, status)
  values (v_user_id, v_email, 'pptroiano', 'OWNER', 'APPROVED');

  insert into public.role_audit_logs
    (actor_id, target_user_id, action, old_value, new_value, reason)
  values
    (null, v_user_id, 'ROLE_CHANGED', null, 'OWNER',
     'Initial OWNER bootstrap explicitly approved by the project owner; email verified in Supabase Auth.');
end $$;
