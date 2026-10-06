P="su postgres -c"
$P "psql -q -d fresh" <<'EOF'
reset role;
insert into auth.users(id,email) values ('f0f0f0f0-0000-0000-0000-000000000009','race-org@x.in');
update public.users set role='faculty' where email='race-org@x.in';
insert into auth.users(id,email) select gen_random_uuid(), 'c'||g||'@x.in' from generate_series(1,2) g;
insert into public.events(title,date,max_participants,user_id) values ('Race',now()+interval '2 days',1,'f0f0f0f0-0000-0000-0000-000000000009');
EOF
cat > /tmp/raceA.sql <<'EOF'
begin; select set_config('request.jwt.claim.sub',(select id::text from public.users where email='c1@x.in'),true); set local role authenticated;
select 'A registered id=', public.register_for_event((select id from public.events where title='Race'));
select pg_sleep(2); commit;
EOF
cat > /tmp/raceB.sql <<'EOF'
begin; select set_config('request.jwt.claim.sub',(select id::text from public.users where email='c2@x.in'),true); set local role authenticated;
select 'B registered id=', public.register_for_event((select id from public.events where title='Race'));
commit;
EOF
( $P "psql -q -t -A -d fresh -f /tmp/raceA.sql" > /tmp/A.out 2>&1 & ) ; sleep 0.7
$P "psql -q -t -A -d fresh -f /tmp/raceB.sql" > /tmp/B.out 2>&1 ; sleep 2.5
echo "A: $(grep -v '^$' /tmp/A.out | head -2 | tr '\n' ' ')"; echo "B: $(grep -E 'ERROR|registered' /tmp/B.out | head -1)"
$P "psql -t -A -d fresh -c \"select 'RESULT 1-seat race: registrations='||count(*)||', counter='||(select current_participants from public.events where title='Race') from public.registrations where event_id=(select id from public.events where title='Race')\""

echo; echo "=== 30 parallel sessions, 5 seats ==="
$P "psql -q -d fresh -c \"insert into auth.users(id,email) select gen_random_uuid(),'p'||g||'@x.in' from generate_series(1,30) g; insert into public.events(title,date,max_participants,user_id) values ('Stress',now()+interval '2 days',5,'f0f0f0f0-0000-0000-0000-000000000009');\""
for i in $(seq 1 30); do
 ( $P "psql -q -t -A -d fresh -c \"begin; select set_config('request.jwt.claim.sub',(select id::text from public.users where email='p$i@x.in'),true); set local role authenticated; select public.register_for_event((select id from public.events where title='Stress')); commit;\"" >/dev/null 2>&1 & )
done; sleep 8
$P "psql -t -A -d fresh -c \"select 'RESULT stress: registrations='||count(*)||', counter='||(select current_participants from public.events where title='Stress') from public.registrations where event_id=(select id from public.events where title='Stress')\""

echo; echo "=== idempotency: re-run on populated DB ==="
for f in migrations/20261006000000_campusone_initial_schema.sql migrations/20261006000100_campusone_features.sql migrations/20261006000200_campusone_security_hardening.sql migrations/20261006000300_campusone_event_approval_and_club_privacy.sql migrations/20261006000400_campusone_final_hardening.sql migrations/20261006000500_campusone_registration_update_guard.sql migrations/20261006000600_campusone_notification_cooldown.sql campusone_full_setup.sql; do
  $P "psql -q -v ON_ERROR_STOP=1 -d fresh -f /home/claude/campusone/supabase/$f" >/tmp/re.out 2>&1; rc=$?
  echo "rerun $(basename $f): exit=$rc $(grep -v NOTICE /tmp/re.out | head -2)"; done
$P "psql -t -A -d fresh -c \"select 'data intact: users='||(select count(*) from public.users)||' events='||(select count(*) from public.events)||' registrations='||(select count(*) from public.registrations)\""
