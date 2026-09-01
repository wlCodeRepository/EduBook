-- Edge Functions authenticate callers first, then use service_role for the
-- privileged database operation. service_role bypasses RLS but still requires
-- table privileges; without these grants administrator account provisioning
-- cannot read or create profile rows.
--
-- The browser uses only the anon/authenticated keys and receives none of
-- these additional privileges.

grant usage on schema public to service_role;

grant select, insert, update, delete
  on public.profiles,
     public.teacher_availability,
     public.teacher_blocked_periods,
     public.bookings,
     public.notification_logs
  to service_role;
