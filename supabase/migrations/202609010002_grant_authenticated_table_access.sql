-- Grant the authenticated API role access to application tables.
-- Row-level security policies remain the boundary for which records each user
-- can read or mutate.

grant usage on schema public to authenticated;

grant select, insert, update, delete
  on public.profiles,
     public.teacher_availability,
     public.teacher_blocked_periods,
     public.bookings,
     public.notification_logs
  to authenticated;
