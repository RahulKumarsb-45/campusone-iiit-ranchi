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
