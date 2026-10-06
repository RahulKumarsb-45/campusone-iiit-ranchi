-- =====================================================================================
-- CampusOne – IIIT Ranchi · 1/2 · BASE SCHEMA (fresh Supabase project)
-- Creates users / events / registrations exactly as the app code uses them
-- (lib/supabase.ts types, createEvent, registerForEvent, VolunteerForm, auth-context),
-- plus helpers, profile auto-creation, atomic registration and Row Level Security.
-- Idempotent: safe on an empty project AND on a project that already has these tables.
-- NEVER drops tables or data.
-- =====================================================================================

-- ---------- helpers that don't depend on any table -----------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- ---------- 1. users (profile row for auth.users) ------------------------------------
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text not null default '',
  role        text not null default 'student',
  department  text,
  year        text,
  roll_number text,
  position    text,
  phone       text,
  address     text,
  bio         text,
  avatar_url  text,
  branch      text,
  batch       text,
  semester    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- If a users table already existed, make sure every column the app uses is there.
alter table public.users add column if not exists email text;
alter table public.users add column if not exists name text not null default '';
alter table public.users add column if not exists role text not null default 'student';
alter table public.users add column if not exists department text;
alter table public.users add column if not exists year text;
alter table public.users add column if not exists roll_number text;
alter table public.users add column if not exists position text;
alter table public.users add column if not exists phone text;
alter table public.users add column if not exists address text;
alter table public.users add column if not exists bio text;
alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists branch text;
alter table public.users add column if not exists batch text;
alter table public.users add column if not exists semester text;
alter table public.users add column if not exists created_at timestamptz not null default now();
alter table public.users add column if not exists updated_at timestamptz not null default now();

alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role in ('student','faculty','guest','club_admin','admin'));

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- ---------- 2. role helpers (need public.users) --------------------------------------
create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as
$$ select role from public.users where id = auth.uid() $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'admin' from public.users where id = auth.uid()), false) $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('admin','club_admin') from public.users where id = auth.uid()), false) $$;

-- Privilege-escalation guard. Sign-up can only ever produce student / faculty / guest;
-- only an admin (or a trusted context with no JWT, e.g. the SQL editor) can set admin / club_admin.
create or replace function public.guard_user_role() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then return new; end if;               -- SQL editor / service role
  if tg_op = 'INSERT' then
    if new.role in ('admin','club_admin') and not public.is_admin() then new.role := 'student'; end if;
  elsif new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_user_role on public.users;
create trigger trg_guard_user_role before insert or update on public.users
  for each row execute function public.guard_user_role();

-- ---------- 3. auto-create the profile when someone signs up -------------------------
-- The app also inserts/reads the profile itself (auth-context.tsx); a duplicate insert is
-- tolerated there (23505), so the two paths never conflict.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as
$$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.users (id, email, name, role, department, year, roll_number, position, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(m->>'name',''), nullif(m->>'full_name',''), split_part(coalesce(new.email,'student'), '@', 1)),
    case when m->>'role' in ('student','faculty','guest') then m->>'role' else 'student' end,  -- never admin/club_admin
    nullif(m->>'department',''), nullif(m->>'year',''), nullif(m->>'roll_number',''),
    nullif(m->>'position',''), coalesce(nullif(m->>'avatar_url',''), nullif(m->>'picture',''))
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;   -- never block sign-up
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------- 3b. upgrade legacy tables in place (only runs if the tables already existed) -------
-- The original app typed user ids as strings. If an older project stored them as text, convert
-- them to uuid (unparseable values become NULL rather than failing the migration).
do $$
declare r record;
begin
  for r in select table_name from information_schema.columns
           where table_schema='public' and column_name='user_id'
             and table_name in ('events','registrations') and data_type in ('text','character varying')
  loop
    execute format($f$alter table public.%I alter column user_id type uuid
                      using (case when user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then user_id::uuid end)$f$, r.table_name);
  end loop;
end $$;

-- ---------- 4. events -----------------------------------------------------------------
create table if not exists public.events (
  id                     bigint generated always as identity primary key,
  title                  text not null,
  description            text not null default '',
  long_description       text,
  image                  text,
  date                   timestamptz not null,
  end_date               timestamptz,
  registration_deadline  timestamptz,
  location               text not null default '',
  address                text,
  category               text not null default 'other',
  other_category_details text,
  tags                   text[] not null default '{}',
  organizer              text not null default '',
  lead_organizer         text,
  convener               text,
  coordinator            text,
  contact_number         text,
  registration_link      text,
  is_paid                boolean not null default false,
  price                  numeric(10,2),
  max_participants       integer not null default 100 check (max_participants >= 0),
  current_participants   integer not null default 0 check (current_participants >= 0),
  needs_volunteers       boolean not null default false,
  volunteer_roles        text[],
  is_published           boolean not null default true,
  club_id                bigint,                                   -- FK added by the features migration
  user_id                uuid references public.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
alter table public.events add column if not exists description text not null default '';
alter table public.events add column if not exists image text;
alter table public.events add column if not exists location text not null default '';
alter table public.events add column if not exists category text not null default 'other';
alter table public.events add column if not exists tags text[] not null default '{}';
alter table public.events add column if not exists organizer text not null default '';
alter table public.events add column if not exists is_paid boolean not null default false;
alter table public.events add column if not exists max_participants integer not null default 100;
alter table public.events add column if not exists current_participants integer not null default 0;
alter table public.events add column if not exists user_id uuid;
alter table public.events add column if not exists created_at timestamptz not null default now();
alter table public.events add column if not exists long_description text;
alter table public.events add column if not exists end_date timestamptz;
alter table public.events add column if not exists registration_deadline timestamptz;
alter table public.events add column if not exists address text;
alter table public.events add column if not exists other_category_details text;
alter table public.events add column if not exists lead_organizer text;
alter table public.events add column if not exists convener text;
alter table public.events add column if not exists coordinator text;
alter table public.events add column if not exists contact_number text;
alter table public.events add column if not exists registration_link text;
alter table public.events add column if not exists price numeric(10,2);
alter table public.events add column if not exists needs_volunteers boolean not null default false;
alter table public.events add column if not exists volunteer_roles text[];
alter table public.events add column if not exists is_published boolean not null default true;
alter table public.events add column if not exists club_id bigint;
alter table public.events add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

-- Clients may never set the participant counter. Only the registrations trigger (nested
-- trigger depth > 1) and trusted no-JWT contexts can change it.
create or replace function public.guard_event_counters() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then new.current_participants := 0;
  else new.current_participants := old.current_participants; end if;
  return new;
end $$;
drop trigger if exists trg_guard_event_counters on public.events;
create trigger trg_guard_event_counters before insert or update on public.events
  for each row execute function public.guard_event_counters();

create index if not exists idx_events_date           on public.events (date);
create index if not exists idx_events_category       on public.events (category);
create index if not exists idx_events_user_id        on public.events (user_id);
create index if not exists idx_events_published_date on public.events (is_published, date);

-- ---------- 5. registrations ----------------------------------------------------------
create table if not exists public.registrations (
  id                bigint generated always as identity primary key,
  event_id          bigint not null references public.events(id) on delete cascade,
  user_id           uuid   not null references public.users(id)  on delete cascade,
  registration_date timestamptz not null default now(),
  payment_status    text check (payment_status in ('pending','completed')),
  payment_id        text,
  is_volunteer      boolean not null default false,
  volunteer_role    text,
  created_at        timestamptz not null default now(),
  constraint registrations_event_user_key unique (event_id, user_id)   -- no duplicates (VolunteerForm relies on 23505)
);
create index if not exists idx_registrations_user_id on public.registrations (user_id);
alter table public.registrations add column if not exists registration_date timestamptz not null default now();
alter table public.registrations add column if not exists payment_status text;
alter table public.registrations add column if not exists payment_id text;
alter table public.registrations add column if not exists is_volunteer boolean not null default false;
alter table public.registrations add column if not exists volunteer_role text;
alter table public.registrations add column if not exists created_at timestamptz not null default now();

-- Pre-existing registrations tables may lack the unique key: add it when no duplicates exist,
-- otherwise warn (resolve the duplicates, then re-run) instead of destroying anyone's data.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.registrations'::regclass and contype='u'
                 and conkey @> array[(select attnum from pg_attribute where attrelid='public.registrations'::regclass and attname='event_id'),
                                     (select attnum from pg_attribute where attrelid='public.registrations'::regclass and attname='user_id')]) then
    if exists (select 1 from public.registrations group by event_id, user_id having count(*) > 1) then
      raise warning 'registrations has duplicate (event_id,user_id) rows; unique key NOT added. Remove duplicates and re-run.';
    else
      alter table public.registrations add constraint registrations_event_user_key unique (event_id, user_id);
    end if;
  end if;
end $$;


-- Atomic capacity / duplicate / counter handling. The BEFORE trigger locks the event row,
-- so concurrent sign-ups for the last seat are serialised and the loser gets EVENT_FULL.
-- It protects EVERY insert path (RPC, registerForEvent, VolunteerForm direct insert).
create or replace function public.registrations_before_insert() returns trigger
language plpgsql security definer set search_path = public as
$$
declare ev public.events%rowtype; trusted boolean;
begin
  select * into ev from public.events where id = new.event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode = 'P0002'; end if;

  -- Report a duplicate as a duplicate even when the event is now full.
  if exists (select 1 from public.registrations where event_id = new.event_id and user_id = new.user_id) then
    raise exception 'ALREADY_REGISTERED' using errcode = '23505';
  end if;

  trusted := auth.uid() is null or public.is_admin();
  if not trusted then
    if not ev.is_published and ev.user_id is distinct from auth.uid() then
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
drop trigger if exists trg_registrations_before_insert on public.registrations;
create trigger trg_registrations_before_insert before insert on public.registrations
  for each row execute function public.registrations_before_insert();

-- Keeps events.current_participants correct for sign-ups, cancellations and organizer removals.
-- Volunteers are not counted as participants.
create or replace function public.sync_participants() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if tg_op = 'INSERT' and not new.is_volunteer then
    update public.events set current_participants = current_participants + 1 where id = new.event_id;
  elsif tg_op = 'DELETE' and not old.is_volunteer then
    update public.events set current_participants = greatest(current_participants - 1, 0) where id = old.event_id;
  end if;
  return null;
end $$;
drop trigger if exists trg_sync_participants on public.registrations;
create trigger trg_sync_participants after insert or delete on public.registrations
  for each row execute function public.sync_participants();

-- Single atomic entry point for the app (lib/supabase.ts registerForEvent calls this).
-- SECURITY INVOKER: RLS still applies to the caller.
create or replace function public.register_for_event(
  p_event_id bigint, p_is_volunteer boolean default false, p_volunteer_role text default null
) returns bigint
language plpgsql security invoker set search_path = public as
$$
declare rid bigint;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  insert into public.registrations (event_id, user_id, is_volunteer, volunteer_role)
  values (p_event_id, auth.uid(), coalesce(p_is_volunteer,false), p_volunteer_role)
  returning id into rid;
  return rid;
end $$;
revoke execute on function public.register_for_event(bigint, boolean, text) from public, anon;
grant  execute on function public.register_for_event(bigint, boolean, text) to authenticated;

-- ---------- 6. Row Level Security -----------------------------------------------------
alter table public.users         enable row level security;
alter table public.events        enable row level security;
alter table public.registrations enable row level security;

-- users: own profile; admins everything; organizers see registrants of their own events
drop policy if exists "users read own"      on public.users;
create policy "users read own"   on public.users for select to authenticated using (id = auth.uid());
drop policy if exists "users insert own"    on public.users;
create policy "users insert own" on public.users for insert to authenticated with check (id = auth.uid());
drop policy if exists "users update own"    on public.users;
create policy "users update own" on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "campusone admins manage users" on public.users;
create policy "campusone admins manage users" on public.users for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "campusone organizers read registrants" on public.users;
create policy "campusone organizers read registrants" on public.users for select to authenticated
  using (exists (select 1 from public.registrations r join public.events e on e.id = r.event_id
                 where r.user_id = users.id and e.user_id = auth.uid()));

-- events: public can read published events; organizers/admins manage
drop policy if exists "events read"   on public.events;
create policy "events read"   on public.events for select
  using (is_published or user_id = auth.uid() or public.is_admin());
drop policy if exists "events insert" on public.events;
create policy "events insert" on public.events for insert to authenticated
  with check (public.current_role_name() in ('admin','club_admin','faculty') and user_id = auth.uid());
drop policy if exists "events update" on public.events;
create policy "events update" on public.events for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "events delete" on public.events;
create policy "events delete" on public.events for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- registrations: students read/create/cancel their own; organizers manage their events'; admins all.
-- (No UPDATE policy for students, so nobody can mark their own payment as completed.)
drop policy if exists "registrations read own"    on public.registrations;
create policy "registrations read own"   on public.registrations for select to authenticated using (user_id = auth.uid());
drop policy if exists "registrations insert own"  on public.registrations;
create policy "registrations insert own" on public.registrations for insert to authenticated
  with check (user_id = auth.uid() and payment_status is distinct from 'completed');
drop policy if exists "registrations cancel own"  on public.registrations;
create policy "registrations cancel own" on public.registrations for delete to authenticated using (user_id = auth.uid());
drop policy if exists "registrations organizer"   on public.registrations;
create policy "registrations organizer"  on public.registrations for all to authenticated
  using (exists (select 1 from public.events e where e.id = registrations.event_id and e.user_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = registrations.event_id and e.user_id = auth.uid()));
drop policy if exists "campusone admins manage registrations" on public.registrations;
create policy "campusone admins manage registrations" on public.registrations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Supabase grants table access to anon/authenticated by default; RLS above is what restricts rows.
grant select on public.events to anon;
