-- psql only. Run AFTER 202609010005 but BEFORE 202609050001, in a disposable DB.
-- Applies the new migration inside this transaction, then rolls everything back.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values
  ('05000000-0000-0000-0000-000000000001'), ('05000000-0000-0000-0000-000000000002');
insert into public.profiles(id, role, display_name, email, default_lesson_minutes) values
  ('05000000-0000-0000-0000-000000000001', 'TEACHER', 'Backfill Teacher', 'backfill-teacher@example.invalid', 30),
  ('05000000-0000-0000-0000-000000000002', 'STUDENT', 'Backfill Student', 'backfill-student@example.invalid', 60);
-- The current teacher setting is deliberately different from historical duration.
-- Include a sub-minute legacy interval to ensure there is no rounding to integers.
insert into public.bookings(teacher_id, student_id, start_at_utc, end_at_utc, status)
select '05000000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-000000000002',
  '2020-01-01 00:00Z'::timestamptz + n * interval '1 day',
  '2020-01-01 00:00Z'::timestamptz + n * interval '1 day' + duration, 'PENDING'
from (values (1, interval '60 minutes'), (2, interval '45 minutes 0.000001 seconds'), (3, interval '300 minutes')) v(n, duration);
update public.bookings set status = 'CONFIRMED', confirmed_at = '2019-12-01 00:00Z'
where teacher_id = '05000000-0000-0000-0000-000000000001' and start_at_utc = '2020-01-02 00:00Z';
update public.bookings set status = 'CANCELLED', cancelled_at = '2019-12-02 00:00Z'
where teacher_id = '05000000-0000-0000-0000-000000000001' and start_at_utc = '2020-01-03 00:00Z';
create temporary table before_migration as select to_jsonb(b) as original from public.bookings b;
\ir ../migrations/202609050001_continuous_booking.sql
do $$
begin
  if exists (
    select 1 from before_migration old
    full join public.bookings b on b.id = (old.original->>'id')::uuid
    where (to_jsonb(b) - 'lesson_minutes' - 'lesson_count') is distinct from old.original
       or b.lesson_count <> 1
       or b.lesson_minutes is distinct from extract(epoch from (b.end_at_utc - b.start_at_utc)) / 60
  ) then raise exception 'Backfill changed history or inferred duration from current teacher settings'; end if;
end;
$$;
rollback;
