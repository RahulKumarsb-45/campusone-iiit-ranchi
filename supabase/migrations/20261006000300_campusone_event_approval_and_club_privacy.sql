-- =====================================================================================
-- CampusOne – IIIT Ranchi · 4/4 · EVENT APPROVAL + CLUB MEMBER PRIVACY
-- Requires migrations 1-3. Idempotent; never drops tables or data.
--
-- 1) Event approval. Anyone can sign up as "faculty" and faculty may create events, so a new
--    event by a non-admin is always created UNPUBLISHED (= pending approval) and only an admin
--    can publish it. Already-published events stay published. is_published stays the single
--    source of truth (published = approved), so no UI query changes.
-- 2) club_members was readable by every signed-in user. Rows are now visible to the member,
--    the club lead and admins; the public member count comes from club_member_count().
-- =====================================================================================

create or replace function public.guard_event_publish() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;   -- SQL editor / admins
  if tg_op = 'INSERT' then
    new.is_published := false;
  elsif new.is_published and not old.is_published then
    new.is_published := false;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_event_publish on public.events;
create trigger trg_guard_event_publish before insert or update on public.events
  for each row execute function public.guard_event_publish();

create or replace function public.is_club_lead(p_club_id bigint) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.clubs where id = p_club_id and lead_user_id = auth.uid()) $$;

create or replace function public.club_member_count(p_club_id bigint) returns integer
language sql stable security definer set search_path = public as
$$ select count(*)::int
   from public.club_members m join public.clubs c on c.id = m.club_id
   where m.club_id = p_club_id and (c.is_published or public.is_admin()) $$;
revoke execute on function public.club_member_count(bigint) from public;
grant  execute on function public.club_member_count(bigint) to anon, authenticated;

drop policy if exists "members read" on public.club_members;
create policy "members read" on public.club_members for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_club_lead(club_id));
