#!/bin/sh
# Regenerates supabase/campusone_full_setup.sql from supabase/migrations/*.sql (in order).
# Usage: sh supabase/build_full_setup.sh          # rewrite the file
#        sh supabase/build_full_setup.sh --check  # exit 1 if it is out of date
# Use EITHER the migrations folder (supabase db push) OR the full setup file, never both on one database.
cd "$(dirname "$0")" || exit 1
out=$(mktemp)
{
  echo "-- CampusOne full setup: GENERATED from supabase/migrations by supabase/build_full_setup.sh. Do not edit."
  echo "-- Paste into the SQL editor of a project that has NOT used 'supabase db push'."
  for f in migrations/*.sql; do printf '\n-- ===== %s =====\n' "$(basename "$f")"; cat "$f"; done
} > "$out"
if [ "$1" = "--check" ]; then cmp -s "$out" campusone_full_setup.sql && echo "full_setup is in sync" || { echo "full_setup is OUT OF DATE"; rm -f "$out"; exit 1; }
else mv "$out" campusone_full_setup.sql && echo "wrote campusone_full_setup.sql"; fi
rm -f "$out"
