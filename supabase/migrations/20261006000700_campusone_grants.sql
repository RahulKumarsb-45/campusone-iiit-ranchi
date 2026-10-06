grant usage on schema public to anon, authenticated;

grant select on public.events, public.clubs, public.announcements,
                public.opportunities, public.campus_services,
                public.gallery_items to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.notification_cooldown from anon, authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;