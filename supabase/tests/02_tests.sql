\set ON_ERROR_STOP off
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set F '''ffffffff-0000-0000-0000-000000000001'''
\set S1 '''11111111-0000-0000-0000-000000000001'''
\set S2 '''22222222-0000-0000-0000-000000000002'''
\set S3 '''33333333-0000-0000-0000-000000000003'''

-- 1. base objects exist and are queryable
select t.run('events table exists',        'select * from public.events limit 1');
select t.run('users table exists',         'select * from public.users limit 1');
select t.run('registrations table exists', 'select * from public.registrations limit 1');

-- 2. profile auto-creation (signup trigger) and role sanitising
insert into auth.users(id,email,raw_user_meta_data) values
 (:A,'admin@x.in','{"name":"Ada Admin","role":"admin"}'),      -- tries to self-assign admin at sign-up
 (:F,'fac@x.in','{"name":"Fay Faculty","role":"faculty","department":"CSE","position":"Prof"}'),
 (:S1,'s1@x.in','{"full_name":"Sam One","role":"student","roll_number":"2023001","year":"2"}'),
 (:S2,'s2@x.in','{}'),
 (:S3,'s3@x.in','{"role":"club_admin"}');
select t.eq('one profile per signup',            'select count(*) from public.users', '5');
select t.eq('signup cannot create admin',        'select role from public.users where id='||quote_literal(:A), 'student');
select t.eq('signup cannot create club_admin',   'select role from public.users where id='||quote_literal(:S3), 'student');
select t.eq('faculty role kept + metadata kept', 'select role||department||position from public.users where id='||quote_literal(:F), 'facultyCSEProf');
select t.eq('full_name / roll number kept',      'select name||roll_number from public.users where id='||quote_literal(:S1), 'Sam One2023001');
select t.eq('name falls back to email prefix',   'select name from public.users where id='||quote_literal(:S2), 's2');
-- trusted context (SQL editor) may promote the first admin
update public.users set role='admin' where id=:A;
select t.eq('SQL editor can promote admin',      'select role from public.users where id='||quote_literal(:A), 'admin');

-- 3. privilege escalation attempts as a student
select t.as_user(:S1);
select t.run('student self-update name ok', 'update public.users set name=''Sam Updated'' where id='||quote_literal(:S1));
update public.users set role='admin' where id=:S1;
select t.as_super();
select t.eq('student cannot self-promote to admin', 'select role from public.users where id='||quote_literal(:S1), 'student');
select t.as_user(:S1);
select t.eq('student sees only own profile', 'select count(*) from public.users', '1');
select t.run('student cannot update another profile (0 rows)', 'with u as (update public.users set name=''hacked'' where id='||quote_literal(:S2)||' returning 1) select 1/(case when count(*)=0 then 1 else 0 end) from u');

-- 4. events RLS
select t.as_user(:S1);
select t.run('student cannot create event', 'insert into public.events(title,date,user_id) values (''Nope'', now()+interval ''1 day'', '||quote_literal(:S1)||')', '42501');
select t.as_user(:F);
select t.run('faculty can create event', 'insert into public.events(title,date,location,category,organizer,max_participants,user_id) values (''Hack Night'', now()+interval ''2 days'', ''Lab'', ''hackathon'', ''CSE'', 1, '||quote_literal(:F)||')');
select t.run('faculty cannot create event as someone else', 'insert into public.events(title,date,user_id) values (''Spoof'', now()+interval ''1 day'', '||quote_literal(:S1)||')', '42501');
select t.run('draft event',   'insert into public.events(title,date,max_participants,is_published,user_id) values (''Draft'', now()+interval ''3 days'', 10, false, '||quote_literal(:F)||')');
select t.run('open event (cap 5)', 'insert into public.events(title,date,max_participants,user_id,registration_deadline) values (''Open'', now()+interval ''3 days'', 5, '||quote_literal(:F)||', now()+interval ''2 days'')');
select t.run('closed-deadline event', 'insert into public.events(title,date,max_participants,user_id,registration_deadline) values (''Closed'', now()+interval ''3 days'', 5, '||quote_literal(:F)||', now()-interval ''1 hour'')');
select t.run('past event', 'insert into public.events(title,date,end_date,max_participants,user_id) values (''Past'', now()-interval ''3 days'', now()-interval ''2 days'', 5, '||quote_literal(:F)||')');
select t.run('volunteer event', 'insert into public.events(title,date,max_participants,needs_volunteers,volunteer_roles,user_id) values (''Vol'', now()+interval ''3 days'', 5, true, ''{Usher}'', '||quote_literal(:F)||')');
select t.run('client cannot set counter on insert', 'insert into public.events(title,date,max_participants,current_participants,user_id) values (''Cheat'', now()+interval ''3 days'', 5, 4, '||quote_literal(:F)||')');
select t.as_super();
-- Migration 3: organizer-created events start unpublished and need approval. Approve the fixtures (all but the draft).
update public.events set is_published = true where title <> 'Draft';
select t.eq('insert counter forced to 0', 'select current_participants from public.events where title=''Cheat''', '0');
select t.as_user(:F);
select t.run('owner updates own event', 'update public.events set description=''updated'' where title=''Hack Night''');
update public.events set current_participants=99 where title='Open';
select t.as_super();
select t.eq('owner cannot tamper counter', 'select current_participants from public.events where title=''Open''', '0');
select t.as_user(:S1);
select t.run('student cannot update event (0 rows)', 'with u as (update public.events set title=''x'' returning 1) select 1/(case when count(*)=0 then 1 else 0 end) from u');
select t.run('student cannot delete event (0 rows)', 'with d as (delete from public.events returning 1) select 1/(case when count(*)=0 then 1 else 0 end) from d');
select t.eq('student sees published only (6 of 7)', 'select count(*) from public.events', '6');
select t.as_anon();
select t.eq('anon sees published events only', 'select count(*) from public.events', '6');
select t.run('anon cannot insert event', 'insert into public.events(title,date) values (''x'', now())', '42501');
select t.eq('anon sees no registrations', 'select count(*) from public.registrations', '0');
select t.as_user(:F);
select t.eq('owner sees own draft too', 'select count(*) from public.events', '7');

-- 5. registration: atomic capacity, duplicates, deadline, ended, volunteers
select t.as_user(:S1);
select t.run('student registers (rpc)', 'select public.register_for_event((select id from public.events where title=''Hack Night''))');
select t.run('duplicate registration rejected (23505)', 'select public.register_for_event((select id from public.events where title=''Hack Night''))', '23505');
select t.as_user(:S2);
select t.run('capacity 1: second student gets EVENT_FULL', 'select public.register_for_event((select id from public.events where title=''Hack Night''))', 'EVENT_FULL');
select t.run('direct insert also blocked when full', 'insert into public.registrations(event_id,user_id) select id, '||quote_literal(:S2)||' from public.events where title=''Hack Night''', 'EVENT_FULL');
select t.as_super();
select t.eq('counter = 1 after one signup', 'select current_participants from public.events where title=''Hack Night''', '1');
select t.as_user(:S1);
select t.run('student cancels own registration', 'delete from public.registrations where user_id='||quote_literal(:S1));
select t.as_super();
select t.eq('counter back to 0 after cancel', 'select current_participants from public.events where title=''Hack Night''', '0');
select t.as_user(:S2);
select t.run('freed seat can be taken', 'select public.register_for_event((select id from public.events where title=''Hack Night''))');
select t.run('draft event hidden from registrants', 'select public.register_for_event((select id from public.events where title=''Draft'' ))', 'EVENT_NOT_FOUND');
select t.run('deadline passed -> REGISTRATION_CLOSED', 'select public.register_for_event((select id from public.events where title=''Closed''))', 'REGISTRATION_CLOSED');
select t.run('finished event -> EVENT_ENDED', 'select public.register_for_event((select id from public.events where title=''Past''))', 'EVENT_ENDED');
select t.run('volunteer rejected when event has no volunteer slots', 'select public.register_for_event((select id from public.events where title=''Open''), true, ''Usher'')', 'NOT_ACCEPTING_VOLUNTEERS');
select t.run('volunteer accepted when event needs volunteers', 'select public.register_for_event((select id from public.events where title=''Vol''), true, ''Usher'')');
select t.as_super();
select t.eq('volunteers do not count as participants', 'select current_participants from public.events where title=''Vol''', '0');
select t.as_user(:S1);
select t.run('student cannot self-mark payment completed on insert', 'insert into public.registrations(event_id,user_id,payment_status) select id,'||quote_literal(:S1)||',''completed'' from public.events where title=''Open''', '42501');
select t.run('student registers pending payment ok', 'insert into public.registrations(event_id,user_id,payment_status) select id,'||quote_literal(:S1)||',''pending'' from public.events where title=''Open''');
select t.run('student cannot update own registration (0 rows)', 'with u as (update public.registrations set payment_status=''completed'' where user_id='||quote_literal(:S1)||' returning 1) select 1/(case when count(*)=0 then 1 else 0 end) from u');
select t.run('student cannot register as someone else', 'insert into public.registrations(event_id,user_id) select id,'||quote_literal(:S3)||' from public.events where title=''Open''', '42501');
select t.eq('student sees only own registrations', 'select count(*) from public.registrations', '1');
select t.as_user(:S3);
select t.eq('other student sees none of them', 'select count(*) from public.registrations', '0');
select t.as_user(:F);
select t.eq('organizer sees registrations for own events', 'select count(*) from public.registrations', '3');
select t.eq('organizer can read registrant names', 'select count(*) from public.users where id in ('||quote_literal(:S1)||','||quote_literal(:S2)||')', '2');
select t.run('organizer can mark payment completed', 'update public.registrations set payment_status=''completed'' where user_id='||quote_literal(:S1));
select t.run('organizer cannot register another user', 'insert into public.registrations(event_id,user_id) select id,'||quote_literal(:S3)||' from public.events where title=''Open''', '42501');
select t.as_user(:A);
select t.eq('admin sees all registrations', 'select count(*) from public.registrations', '3');
select t.eq('admin sees all users', 'select count(*) from public.users', '5');
select t.run('admin can promote a club_admin', 'update public.users set role=''club_admin'' where id='||quote_literal(:S3));
select t.as_super();
select t.eq('admin promotion persisted', 'select role from public.users where id='||quote_literal(:S3), 'club_admin');

-- 6. feature tables RLS
select t.as_user(:S1);
select t.run('student cannot post announcement', 'insert into public.announcements(title,body) values (''x'',''y'')', '42501');
select t.run('student reports lost item', 'insert into public.lost_found_items(item_name,contact_info,reporter_id) values (''Keys'',''999'','||quote_literal(:S1)||')');
select t.run('student cannot report as someone else', 'insert into public.lost_found_items(item_name,contact_info,reporter_id) values (''Keys'',''999'','||quote_literal(:S2)||')', '42501');
select t.run('student lists item', 'insert into public.marketplace_listings(title,price,contact_method,seller_id) values (''Book'',100,''wa'','||quote_literal(:S1)||')');
select t.run('negative price rejected', 'insert into public.marketplace_listings(title,price,contact_method,seller_id) values (''Bad'',-1,''wa'','||quote_literal(:S1)||')', '23514');
select t.run('student cannot upload gallery', 'insert into public.gallery_items(title,image_url) values (''p'',''https://x/y.png'')', '42501');
select t.run('student joins club (after admin creates)', 'select 1');
select t.as_user(:A);
select t.run('admin posts announcement', 'insert into public.announcements(kind,title,body,priority) values (''notice'',''Exam'',''Dates'',''urgent'')');
select t.run('admin creates club', 'insert into public.clubs(name,category) values (''PICCELL'',''Arts'')');
select t.run('admin adds service', 'insert into public.campus_services(title,category) values (''Library'',''Library'')');
select t.run('admin links event to club (FK)', 'update public.events set club_id=(select id from public.clubs limit 1) where title=''Open''');
select t.as_user(:S1);
select t.eq('student reads published announcement', 'select count(*) from public.announcements', '1');
select t.run('student joins club', 'insert into public.club_members(club_id,user_id) select id,'||quote_literal(:S1)||' from public.clubs');
select t.run('student cannot add someone else to club', 'insert into public.club_members(club_id,user_id) select id,'||quote_literal(:S2)||' from public.clubs', '42501');
select t.as_user(:S2);
select t.run('other student cannot delete listing (0 rows)', 'with d as (delete from public.marketplace_listings returning 1) select 1/(case when count(*)=0 then 1 else 0 end) from d');
select t.as_anon();
select t.eq('anon reads clubs', 'select count(*) from public.clubs', '1');
select t.eq('anon sees no lost & found', 'select count(*) from public.lost_found_items', '0');
select t.as_user(:A);
select t.run('staff can upload gallery', 'insert into public.gallery_items(title,image_url) values (''p'',''https://x/y.png'')');

-- 7. deleting an event cascades its registrations
select t.as_user(:F);
select t.run('owner deletes event', 'delete from public.events where title=''Hack Night''');
select t.as_super();
select t.eq('registrations cascaded', 'select count(*) from public.registrations r where not exists (select 1 from public.events e where e.id=r.event_id)', '0');

-- 8. event approval + club member privacy (migration 4)
select t.as_user(:F);
select t.run('organizer can create an event', 'insert into public.events(title,date,user_id,is_published) values (''Approval A'', now()+interval ''2 days'', '||quote_literal(:F)||', true)');
select t.eq('organizer event starts unpublished', 'select is_published from public.events where title=''Approval A''', 'false');
select t.run('organizer self-publish attempt does not error', 'update public.events set is_published=true where title=''Approval A''');
select t.eq('organizer cannot self-publish', 'select is_published from public.events where title=''Approval A''', 'false');
select t.as_user(:A);
select t.run('admin publishes event', 'update public.events set is_published=true where title=''Approval A''');
select t.eq('admin approval sticks', 'select is_published from public.events where title=''Approval A''', 'true');
select t.run('admin creates club', 'insert into public.clubs(name) values (''Test Club'')');
select t.as_user(:S1);
select t.run('student joins club', 'insert into public.club_members(club_id,user_id) select id,'||quote_literal(:S1)||' from public.clubs where name=''Test Club''');
select t.as_user(:S2);
select t.eq('other student cannot list club members', 'select count(*) from public.club_members', '0');
select t.eq('member count function still works', 'select public.club_member_count(id) from public.clubs where name=''Test Club''', '1');
select t.as_super();

-- 9. final hardening (migration 5)
select t.as_user(:F);
select t.run('organizer cannot register for own unpublished event', 'select public.register_for_event((select id from public.events where title=''Draft''))', 'EVENT_NOT_FOUND');
select t.run('non-lead cannot attach event to a club', 'update public.events set club_id=(select id from public.clubs limit 1) where title=''Approval A''', '42501');
select t.as_user(:S1);
select t.run('student email edit does not error', 'update public.users set email=''hijack@x.in'' where id='||quote_literal(:S1));
select t.eq('student cannot rewrite own email', 'select (email=''hijack@x.in'') from public.users where id='||quote_literal(:S1), 'false');
select t.run('non-http avatar rejected', 'update public.users set avatar_url=''javascript:alert(1)'' where id='||quote_literal(:S1), '23514');
select t.as_user(:A);
select t.run('admin cannot attribute gallery upload to someone else', 'insert into public.gallery_items(title,image_url,uploaded_by) values (''g'',''https://x.in/a.png'','||quote_literal(:S1)||')', '42501');
select t.run('admin uploads own gallery item', 'insert into public.gallery_items(title,image_url) values (''g2'',''https://x.in/b.png'')');
select t.as_super();

-- 10. organizers may update operational fields only (migration 6)
select t.as_super();
select t.run('setup guard event', 'insert into public.events(title,date,user_id) values (''Guard E'', now()+interval ''4 days'','||quote_literal(:F)||')');
select t.run('setup guard registration', 'insert into public.registrations(event_id,user_id) select id,'||quote_literal(:S1)||' from public.events where title=''Guard E''');
select t.as_user(:F);
select t.run('organizer cannot change registration user_id', 'update public.registrations set user_id='||quote_literal(:S3)||' where event_id=(select id from public.events where title=''Guard E'')', '42501');
select t.run('organizer cannot move registration to another event', 'update public.registrations set event_id=(select id from public.events where title=''Open'') where event_id=(select id from public.events where title=''Guard E'')', '42501');
select t.run('organizer cannot flip volunteer flag', 'update public.registrations set is_volunteer=true where event_id=(select id from public.events where title=''Guard E'')', '42501');
select t.run('organizer can set payment status', 'update public.registrations set payment_status=''completed'' where event_id=(select id from public.events where title=''Guard E'')');
select t.eq('payment status was updated', 'select payment_status from public.registrations where event_id=(select id from public.events where title=''Guard E'')', 'completed');
select t.eq('participant counter unchanged by updates', 'select current_participants from public.events where title=''Guard E''', '1');
select t.as_super();

-- 11. global notification cooldown (migration 7)
select t.as_user(:S1);
select t.eq('first claim succeeds', 'select public.claim_notification((select id from public.events where title=''Open''), ''registration'')', 'true');
select t.eq('second claim within 60s is refused', 'select public.claim_notification((select id from public.events where title=''Open''), ''registration'')', 'false');
select t.eq('different type has its own cooldown', 'select public.claim_notification((select id from public.events where title=''Open''), ''volunteer'')', 'true');
select t.run('invalid type rejected', 'select public.claim_notification((select id from public.events where title=''Open''), ''spam'')', '22023');
select t.run('client cannot read cooldown table', 'select * from public.notification_cooldown', '42501');
select t.run('client cannot write cooldown table', 'update public.notification_cooldown set sent_at = now()', '42501');
select t.as_user(:S2);
select t.eq('other user is independent', 'select public.claim_notification((select id from public.events where title=''Open''), ''registration'')', 'true');
select t.as_super();
update public.notification_cooldown set sent_at = now() - interval '61 seconds' where user_id = :S1::uuid;
select t.as_user(:S1);
select t.eq('claim allowed again after cooldown', 'select public.claim_notification((select id from public.events where title=''Open''), ''registration'')', 'true');
select t.as_anon();
select t.run('anon cannot call claim_notification', 'select public.claim_notification(1, ''registration'')', '42501');
select t.as_super();

-- 12. volunteer role validation (migration 7)
select t.as_super();
select t.run('setup role event', 'insert into public.events(title,date,needs_volunteers,volunteer_roles,user_id,is_published) values (''Role E'', now()+interval ''4 days'', true, ''{Usher,Guide}'', '||quote_literal(:F)||', false)');
update public.events set is_published = true where title = 'Role E';
select t.as_user(:S1);
select t.run('role outside the offered list rejected', 'select public.register_for_event((select id from public.events where title=''Role E''), true, ''Hacker'')', '22023');
select t.run('over-long role rejected', 'select public.register_for_event((select id from public.events where title=''Role E''), true, '||quote_literal(repeat('x',81))||')', '22023');
select t.run('offered role accepted', 'select public.register_for_event((select id from public.events where title=''Role E''), true, ''Usher'')');
select t.as_user(:S2);
select t.run('role is dropped for non-volunteer registration', 'select public.register_for_event((select id from public.events where title=''Role E''), false, ''Usher'')');
select t.as_super();
select t.eq('non-volunteer stored role is null', 'select coalesce(volunteer_role,''none'') from public.registrations where user_id='||quote_literal(:S2)||' and event_id=(select id from public.events where title=''Role E'')', 'none');

select name, case when ok then 'PASS' else 'FAIL' end as result, case when ok then '' else detail end as detail from t.results order by n;
