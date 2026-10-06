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
