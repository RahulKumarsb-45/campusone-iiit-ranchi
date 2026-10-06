Local database tests (plain PostgreSQL, no Supabase needed). They stand in for Supabase's `auth` schema and roles.
  createdb fresh && psql -d fresh -f 00_supabase_stub.sql
  psql -d fresh -f ../migrations/20261006000000_campusone_initial_schema.sql
  psql -d fresh -f ../migrations/20261006000100_campusone_features.sql
  psql -d fresh -f ../migrations/20261006000200_campusone_security_hardening.sql
  psql -d fresh -f ../migrations/20261006000300_campusone_event_approval_and_club_privacy.sql
  psql -d fresh -f ../migrations/20261006000400_campusone_final_hardening.sql
  psql -d fresh -f ../migrations/20261006000500_campusone_registration_update_guard.sql
  psql -d fresh -f ../migrations/20261006000600_campusone_notification_cooldown.sql
  psql -d fresh -f 01_harness.sql && psql -d fresh -f 02_tests.sql -t -A   # every row must say PASS
Last full run (PostgreSQL 16, fresh DB, migrations 1-7): 121/121 PASS in 02_tests.sql; 03_* last-seat race, 30-way stress and migration re-runs all OK. Also exercised through the real PostgREST 12.2.12 HTTP API with signed JWTs (18/18) and the built /api/notify route (15/15) against a local gateway; these ad-hoc harnesses are not part of the repo.
