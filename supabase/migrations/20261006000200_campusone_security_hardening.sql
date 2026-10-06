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
