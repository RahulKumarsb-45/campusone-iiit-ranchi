# CampusOne – IIIT Ranchi
One Campus. One Platform. Everything IIIT Ranchi.

Next.js 15 · React 19 · Tailwind · Supabase (auth + Postgres).

## Setup (fresh Supabase project)
1. `cp .env.example .env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (SMTP is optional).
2. Database – pick ONE:
   - Supabase CLI: `supabase link` then `supabase db push` (applies `supabase/migrations/*` in order), or
   - SQL editor: paste and run `supabase/campusone_full_setup.sql` (generated from the migrations by `sh supabase/build_full_setup.sh`; use it INSTEAD of `db push`, never both on the same database).
   Both are idempotent and never drop data, so they also upgrade an existing project in place.
3. Register on the site, then make yourself admin (SQL editor): `update public.users set role='admin' where email='you@…';`
4. Auth → URL configuration: add `<site>/auth/callback` and `<site>/auth/reset-password` as redirect URLs.
5. `npm install && npm run build && npm start` (or `npm run dev`).

## Database
- `20261006000000_campusone_initial_schema.sql` – users, events, registrations, role helpers, sign-up profile trigger, atomic `register_for_event`, RLS.
- `20261006000100_campusone_features.sql` – clubs, announcements/notices, placements/internships, services, lost & found, marketplace, gallery, RLS.
- `20261006000200_campusone_security_hardening.sql` – organizers can read/update/delete (not insert) registrations for their own events.
- `20261006000300_campusone_event_approval_and_club_privacy.sql` – events created by non-admins start unpublished until an admin publishes (approves) them; club member rows are private (public count via `club_member_count()`).
- `20261006000400_campusone_final_hardening.sql` – unpublished events accept no registrations, events can only be attached to clubs the user leads, users can't rewrite their email, avatar links must be http(s), gallery uploads are attributed to the uploader.
- `20261006000500_campusone_registration_update_guard.sql` – organizers can update only payment fields on registrations; identity/ownership columns are immutable.
- Authorization is enforced by RLS, not by the UI. Only an admin (or the SQL editor) can grant `admin` / `club_admin`.
