-- CampusOne full setup: GENERATED from supabase/migrations by supabase/build_full_setup.sh. Do not edit.
-- Paste into the SQL editor of a project that has NOT used 'supabase db push'.

-- ===== 20261006000000_campusone_initial_schema.sql =====
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

-- ===== 20261006000100_campusone_features.sql =====
-- =====================================================================================
-- CampusOne – IIIT Ranchi · 2/2 · CAMPUS FEATURE TABLES + RLS
-- Requires 20261006000000_campusone_initial_schema.sql (users / events / registrations
-- and the is_admin() / is_staff() helpers). Idempotent; never drops data.
-- =====================================================================================

-- ============ 3. Clubs ===========================================================
create table if not exists public.clubs (
  id bigint generated always as identity primary key,
  name text not null,
  slug text unique,
  category text,
  description text,
  logo_url text,
  faculty_coordinator text,
  student_leads text,
  contact_email text,
  lead_user_id uuid references public.users(id) on delete set null,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.club_members (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (club_id, user_id)
);

-- ============ 4. Announcements & notices =========================================
create table if not exists public.announcements (
  id bigint generated always as identity primary key,
  kind text not null default 'announcement' check (kind in ('announcement','notice')),
  title text not null,
  body text not null,
  category text,
  priority text not null default 'normal' check (priority in ('normal','important','urgent')),
  attachment_url text,
  author_id uuid references public.users(id) on delete set null,
  author_name text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ 5. Placements & internships ========================================
create table if not exists public.opportunities (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('placement','internship')),
  company text not null,
  role text not null,
  category text,            -- Internship | Full Time | Internship + PPO | Placement Drive
  location text,
  work_mode text,           -- remote | onsite | hybrid (internships)
  domain text,
  duration text,
  stipend text,
  eligibility text,
  batch text,
  min_cgpa numeric(4,2),
  skills text[] not null default '{}',
  deadline timestamptz,
  apply_url text,
  status text not null default 'open' check (status in ('open','closed','upcoming')),
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ 6. Campus services =================================================
create table if not exists public.campus_services (
  id bigint generated always as identity primary key,
  title text not null,
  category text,
  description text,
  contact text,
  location text,
  timings text,
  important_info text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ 7. Lost & found ====================================================
create table if not exists public.lost_found_items (
  id bigint generated always as identity primary key,
  item_name text not null,
  description text,
  category text,
  location text,
  item_date date,
  image_url text,
  status text not null default 'lost' check (status in ('lost','found','claimed','resolved')),
  contact_info text not null,
  reporter_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  reporter_name text,
  created_at timestamptz not null default now()
);

-- ============ 8. Marketplace =====================================================
create table if not exists public.marketplace_listings (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  category text,
  image_url text,
  contact_method text not null,
  status text not null default 'available' check (status in ('available','sold','removed')),
  seller_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  seller_name text,
  created_at timestamptz not null default now()
);

-- ============ 9. Gallery =========================================================
create table if not exists public.gallery_items (
  id bigint generated always as identity primary key,
  title text not null,
  image_url text not null,
  category text,
  caption text,
  club_id bigint references public.clubs(id) on delete set null,
  event_id bigint references public.events(id) on delete set null,
  uploaded_by uuid default auth.uid() references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);


-- events.club_id was created without an FK in the base migration (clubs didn't exist yet).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_club_id_fkey') then
    alter table public.events add constraint events_club_id_fkey
      foreign key (club_id) references public.clubs(id) on delete set null;
  end if;
end $$;
create index if not exists idx_events_club_id on public.events (club_id);
create index if not exists idx_club_members_user on public.club_members (user_id);
create index if not exists idx_announcements_kind on public.announcements (kind, is_published, created_at desc);
create index if not exists idx_opportunities_kind on public.opportunities (kind, status);
create index if not exists idx_lost_found_status  on public.lost_found_items (status, created_at desc);
create index if not exists idx_marketplace_status on public.marketplace_listings (status, created_at desc);

-- ============ 10. Row Level Security =============================================
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.announcements enable row level security;
alter table public.opportunities enable row level security;
alter table public.campus_services enable row level security;
alter table public.lost_found_items enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.gallery_items enable row level security;

-- Public, admin-managed content
do $$
declare t text;
begin
  foreach t in array array['clubs','announcements','opportunities','campus_services'] loop
    execute format('drop policy if exists "read published" on public.%I', t);
    execute format('create policy "read published" on public.%I for select using (is_published or public.is_admin())', t);
    execute format('drop policy if exists "admin write" on public.%I', t);
    execute format('create policy "admin write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Club admins may edit the club they lead
drop policy if exists "club lead update" on public.clubs;
create policy "club lead update" on public.clubs for update to authenticated
  using (lead_user_id = auth.uid()) with check (lead_user_id = auth.uid());

-- Club membership: members manage their own row; admins manage all
drop policy if exists "members read" on public.club_members;
create policy "members read" on public.club_members for select to authenticated using (true);
drop policy if exists "join self" on public.club_members;
create policy "join self" on public.club_members for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "leave self" on public.club_members;
create policy "leave self" on public.club_members for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- Lost & found: signed-in students read; owners/admins modify
drop policy if exists "lf read" on public.lost_found_items;
create policy "lf read" on public.lost_found_items for select to authenticated using (true);
drop policy if exists "lf insert" on public.lost_found_items;
create policy "lf insert" on public.lost_found_items for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists "lf update" on public.lost_found_items;
create policy "lf update" on public.lost_found_items for update to authenticated
  using (reporter_id = auth.uid() or public.is_admin()) with check (reporter_id = auth.uid() or public.is_admin());
drop policy if exists "lf delete" on public.lost_found_items;
create policy "lf delete" on public.lost_found_items for delete to authenticated using (reporter_id = auth.uid() or public.is_admin());

-- Marketplace: same ownership model (listings are visible to signed-in users only)
drop policy if exists "mk read" on public.marketplace_listings;
create policy "mk read" on public.marketplace_listings for select to authenticated using (status <> 'removed' or seller_id = auth.uid() or public.is_admin());
drop policy if exists "mk insert" on public.marketplace_listings;
create policy "mk insert" on public.marketplace_listings for insert to authenticated with check (seller_id = auth.uid());
drop policy if exists "mk update" on public.marketplace_listings;
create policy "mk update" on public.marketplace_listings for update to authenticated
  using (seller_id = auth.uid() or public.is_admin()) with check (seller_id = auth.uid() or public.is_admin());
drop policy if exists "mk delete" on public.marketplace_listings;
create policy "mk delete" on public.marketplace_listings for delete to authenticated using (seller_id = auth.uid() or public.is_admin());

-- Gallery: public read; admins and club admins upload; uploader/admin delete
drop policy if exists "gallery read" on public.gallery_items;
create policy "gallery read" on public.gallery_items for select using (true);
drop policy if exists "gallery insert" on public.gallery_items;
create policy "gallery insert" on public.gallery_items for insert to authenticated with check (public.is_staff());
drop policy if exists "gallery delete" on public.gallery_items;
create policy "gallery delete" on public.gallery_items for delete to authenticated using (uploaded_by = auth.uid() or public.is_admin());
drop policy if exists "gallery update" on public.gallery_items;
create policy "gallery update" on public.gallery_items for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Promote your first admin manually (replace the email), then manage roles from the app:
-- update public.users set role = 'admin' where email = 'you@iiitranchi.ac.in';

-- ===== 20261006000200_campusone_security_hardening.sql =====
-- =====================================================================================
-- CampusOne – IIIT Ranchi · 3/3 · SECURITY HARDENING
-- Requires migrations 1 and 2. Idempotent; never drops tables or data.
--
-- The base migration let event organizers do ANYTHING on registrations for their events
-- (FOR ALL), including INSERTing a registration on behalf of an arbitrary user. Organizers
-- only need to read, update (e.g. mark payment) and remove registrations; students register
-- themselves through register_for_event(). Replace that policy with per-command policies
-- that leave out INSERT.
-- =====================================================================================

drop policy if exists "registrations organizer" on public.registrations;
drop policy if exists "registrations organizer read"   on public.registrations;
drop policy if exists "registrations organizer update" on public.registrations;
drop policy if exists "registrations organizer delete" on public.registrations;

create policy "registrations organizer read" on public.registrations for select to authenticated
  using (exists (select 1 from public.events e where e.id = registrations.event_id and e.user_id = auth.uid()));

create policy "registrations organizer update" on public.registrations for update to authenticated
  using      (exists (select 1 from public.events e where e.id = registrations.event_id and e.user_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = registrations.event_id and e.user_id = auth.uid()));

create policy "registrations organizer delete" on public.registrations for delete to authenticated
  using (exists (select 1 from public.events e where e.id = registrations.event_id and e.user_id = auth.uid()));

-- ===== 20261006000300_campusone_event_approval_and_club_privacy.sql =====
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

-- ===== 20261006000400_campusone_final_hardening.sql =====
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

-- ===== 20261006000500_campusone_registration_update_guard.sql =====
-- =====================================================================================
-- CampusOne – IIIT Ranchi · 6/6 · REGISTRATION UPDATE GUARD
-- Requires migrations 1-5. Idempotent; never drops tables or data.
--
-- The organizer UPDATE policy limits WHICH rows an organizer can touch (their own events'), but RLS
-- cannot limit WHICH COLUMNS. Organizers need to update operational data (payment_status, payment_id)
-- only. Changing identity/ownership columns is rejected for everyone except admins and trusted
-- no-JWT contexts (SQL editor / service role):
--   id, event_id, user_id, is_volunteer, volunteer_role, registration_date, created_at
-- (event_id / is_volunteer also drive events.current_participants, so they must not move.)
-- =====================================================================================

create or replace function public.guard_registration_update() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.id is distinct from old.id
     or new.event_id is distinct from old.event_id
     or new.user_id is distinct from old.user_id
     or new.is_volunteer is distinct from old.is_volunteer
     or new.volunteer_role is distinct from old.volunteer_role
     or new.registration_date is distinct from old.registration_date
     or new.created_at is distinct from old.created_at then
    raise exception 'REGISTRATION_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_registration_update on public.registrations;
create trigger trg_guard_registration_update before update on public.registrations
  for each row execute function public.guard_registration_update();

-- ===== 20261006000600_campusone_notification_cooldown.sql =====
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
