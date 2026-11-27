CREATE OR REPLACE FUNCTION private.renqd_mark_revoked_multiplayer_invitation_notice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public,private
AS $function$
BEGIN
  IF OLD.invitation_status='PENDING' AND NEW.invitation_status='REVOKED' AND NEW.user_id IS NOT NULL THEN
    UPDATE public.user_notifications
    SET read_at=coalesce(read_at,now()),
        payload=jsonb_set(coalesce(payload,'{}'::jsonb),'{response}',to_jsonb('REVOKED'::text),true)
    WHERE recipient_id=NEW.user_id
      AND notification_type='RANKING_INVITE'
      AND payload->>'participantId'=NEW.id::text;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.renqd_mark_revoked_multiplayer_invitation_notice() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS ranking_participant_revoked_invite_notice ON public.ranking_participants;
CREATE TRIGGER ranking_participant_revoked_invite_notice
AFTER UPDATE OF invitation_status ON public.ranking_participants
FOR EACH ROW
WHEN (OLD.invitation_status='PENDING' AND NEW.invitation_status='REVOKED')
EXECUTE FUNCTION private.renqd_mark_revoked_multiplayer_invitation_notice();
