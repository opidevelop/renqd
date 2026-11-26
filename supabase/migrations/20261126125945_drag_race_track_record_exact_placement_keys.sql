begin;
delete from public.drag_race_track_record_scoring_rules where placement_key='WIN + RTRN';
insert into public.drag_race_track_record_scoring_rules(placement_key,label,score,color,sort_order) values
('WIN             +        RTRN','WIN + RTRN',5.00,'#228B22',2),
('BTM2       +          QUIT','BTM2 + QUIT',1.00,'#B22222',25)
on conflict(placement_key) do update set label=excluded.label,score=excluded.score,color=excluded.color,sort_order=excluded.sort_order,updated_at=now();
commit;