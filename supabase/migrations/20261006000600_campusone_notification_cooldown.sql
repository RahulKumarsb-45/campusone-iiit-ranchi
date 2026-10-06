-- =====================================================================================
-- CampusOne – IIIT Ranchi · 7/7 · GLOBAL NOTIFICATION COOLDOWN
-- Requires migrations 1-6. Idempotent; never drops tables or data.
--
-- /api/notify keeps a per-instance in-memory limiter, which is not shared between server instances.
-- This adds a database-backed cooldown so the limit holds on multi-instance / serverless hosting.
-- One row per (user, event, type); claim_notification() atomically claims the next send slot:
-- it returns true (and records the time) only if the previous send was more than 60 seconds ago.
-- The table is not reachable from the client; only the RPC is, and it only ever touches auth.uid()'s rows.
-- =====================================================================================

create table if not exists public.notification_cooldown (
  user_id  uuid   not null references public.users(id)  on delete cascade,
  event_id bigint not null references public.events(id) on delete cascade,
  type     text   not null check (type in ('registration','volunteer')),
  sent_at  timestamptz not null default now(),
  primary key (user_id, event_id, type)
);
alter table public.notification_cooldown enable row level security;  -- no policies: no direct client access
revoke all on public.notification_cooldown from public, anon, authenticated;

create or replace function public.claim_notification(p_event_id bigint, p_type text)
returns boolean
language plpgsql security definer set search_path = public as
$$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  if p_type not in ('registration','volunteer') then raise exception 'INVALID_TYPE' using errcode = '22023'; end if;
  insert into public.notification_cooldown(user_id, event_id, type, sent_at)
  values (uid, p_event_id, p_type, now())
  on conflict (user_id, event_id, type)
  do update set sent_at = now()
     where public.notification_cooldown.sent_at <= now() - interval '60 seconds';
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke execute on function public.claim_notification(bigint, text) from public, anon;
grant  execute on function public.claim_notification(bigint, text) to authenticated;

-- ---------- Volunteer role validation ----------------------------------------------------
-- registrations.volunteer_role used to accept any text. /api/notify trusts the stored role, so it must be
-- one the organizer actually offered: when the event defines volunteer_roles the role has to be one of them;
-- otherwise free text is capped at 80 characters. Non-volunteer registrations cannot carry a role.
create or replace function public.validate_volunteer_role() returns trigger
language plpgsql security definer set search_path = public as
$$
declare roles text[];
begin
  if not coalesce(new.is_volunteer, false) then
    new.volunteer_role := null;
    return new;
  end if;
  new.volunteer_role := nullif(btrim(new.volunteer_role), '');
  if new.volunteer_role is null then return new; end if;
  if length(new.volunteer_role) > 80 then
    raise exception 'INVALID_VOLUNTEER_ROLE' using errcode = '22023';
  end if;
  select volunteer_roles into roles from public.events where id = new.event_id;
  if roles is not null and cardinality(roles) > 0 and not (new.volunteer_role = any(roles)) then
    raise exception 'INVALID_VOLUNTEER_ROLE' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists trg_validate_volunteer_role on public.registrations;
create trigger trg_validate_volunteer_role before insert on public.registrations
  for each row execute function public.validate_volunteer_role();
