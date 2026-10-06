-- =====================================================================================
-- CampusOne – IIIT Ranchi · 5/5 · FINAL HARDENING
-- Requires migrations 1-4. Idempotent; never drops tables or data.
--  1) Unpublished events accept NO registrations from non-admins (owners included).
--  2) Only an admin or the lead of a club may attach an event to that club.
--  3) public.users.email cannot be rewritten by the user; avatar_url must be http(s).
--  4) gallery_items.uploaded_by can no longer be spoofed.
-- =====================================================================================

-- 1) same function as migration 1 with the owner exception for unpublished events removed
create or replace function public.registrations_before_insert() returns trigger
language plpgsql security definer set search_path = public as
$$
declare ev public.events%rowtype; trusted boolean;
begin
  select * into ev from public.events where id = new.event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode = 'P0002'; end if;

  if exists (select 1 from public.registrations where event_id = new.event_id and user_id = new.user_id) then
    raise exception 'ALREADY_REGISTERED' using errcode = '23505';
  end if;

  trusted := auth.uid() is null or public.is_admin();
  if not trusted then
    if not ev.is_published then
      raise exception 'EVENT_NOT_FOUND' using errcode = 'P0002';
    end if;
    if now() >= coalesce(ev.end_date, ev.date + interval '6 hours') then
      raise exception 'EVENT_ENDED' using errcode = 'P0001';
    end if;
    if ev.registration_deadline is not null and now() > ev.registration_deadline then
      raise exception 'REGISTRATION_CLOSED' using errcode = 'P0001';
    end if;
    if new.is_volunteer and not ev.needs_volunteers then
      raise exception 'NOT_ACCEPTING_VOLUNTEERS' using errcode = 'P0001';
    end if;
    if not new.is_volunteer and ev.max_participants > 0 and ev.current_participants >= ev.max_participants then
      raise exception 'EVENT_FULL' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

-- 2) club ownership of events
create or replace function public.guard_event_club() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.club_id is not null and (tg_op = 'INSERT' or new.club_id is distinct from old.club_id)
     and not public.is_club_lead(new.club_id) then
    raise exception 'NOT_CLUB_LEAD' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_event_club on public.events;
create trigger trg_guard_event_club before insert or update on public.events
  for each row execute function public.guard_event_club();

-- 3) profile integrity
create or replace function public.guard_user_email() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is not null and not public.is_admin() and new.email is distinct from old.email then
    new.email := old.email;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_user_email on public.users;
create trigger trg_guard_user_email before update on public.users
  for each row execute function public.guard_user_email();

-- NOT VALID: applies to new/changed rows only, so existing data is never rejected.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_avatar_url_http') then
    alter table public.users add constraint users_avatar_url_http
      check (avatar_url is null or avatar_url ~* '^https?://') not valid;
  end if;
end $$;

-- 4) gallery uploads are attributed to the uploader
drop policy if exists "gallery insert" on public.gallery_items;
create policy "gallery insert" on public.gallery_items for insert to authenticated
  with check (public.is_staff() and uploaded_by is not distinct from auth.uid());
