-- Plan: docs/plans/2026-09-05-learning-space.md, Task 1.
-- Apply atomically through the migration runner (or psql --single-transaction).
-- No defaults: new writes must explicitly supply their booking-time snapshots.
alter table public.bookings
  add column lesson_minutes numeric,
  add column lesson_count smallint;

-- Historical bookings represented one lesson. Never infer their duration from
-- today's teacher profile. Numeric preserves even fractional-minute legacy data.
-- Non-finite historical times cannot be meaningfully snapshotted: fail safely,
-- leaving review/recovery to the operator rather than rewriting appointment time.
do $$
begin
  if exists (select 1 from public.bookings
    where not isfinite(start_at_utc) or not isfinite(end_at_utc)) then
    raise exception 'continuous_booking_non_finite_history_requires_review';
  end if;
end;
$$;

update public.bookings
set lesson_minutes = extract(epoch from (end_at_utc - start_at_utc)) / 60,
    lesson_count = 1;

alter table public.bookings
  alter column lesson_minutes set not null,
  alter column lesson_count set not null,
  add constraint bookings_lesson_count_check check (lesson_count between 1 and 8),
  add constraint bookings_lesson_minutes_check check (lesson_minutes > 0 and lesson_minutes < 'Infinity'::numeric),
  add constraint bookings_lesson_interval_check check (
    isfinite(start_at_utc) and isfinite(end_at_utc)
    and lesson_minutes * lesson_count = extract(epoch from (end_at_utc - start_at_utc)) / 60
  );

comment on column public.bookings.lesson_minutes is
  'Booking-time per-lesson minutes. New RPC bookings snapshot teacher.default_lesson_minutes; legacy rows use their original full duration.';
comment on column public.bookings.lesson_count is
  'Integer 1..8 lessons in one complete reserved interval. Historical rows are backfilled as one lesson.';

create or replace function public.create_booking(
  p_teacher_id uuid,
  p_student_id uuid,
  p_start_at_utc timestamptz,
  p_end_at_utc timestamptz
)
returns public.bookings
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  teacher public.profiles%rowtype;
  student public.profiles%rowtype;
  duration_seconds numeric;
  lesson_seconds numeric;
  count_value smallint;
  result public.bookings;
begin
  if p_start_at_utc is null or p_end_at_utc is null
     or not isfinite(p_start_at_utc) or not isfinite(p_end_at_utc)
     or p_start_at_utc <= now() or p_end_at_utc <= p_start_at_utc then
    raise exception using errcode = '22023', message = 'invalid_booking_time';
  end if;
  -- UTC and exact seconds: reject fractional seconds without integer rounding.
  if extract(minute from p_start_at_utc at time zone 'UTC')::integer % 15 <> 0
     or extract(second from p_start_at_utc at time zone 'UTC') <> 0 then
    raise exception using errcode = '22023', message = 'start_time_must_be_15_minute_boundary';
  end if;
  select * into teacher from public.profiles where id = p_teacher_id and role = 'TEACHER';
  if not found then raise exception using errcode = 'P0002', message = 'teacher_not_found'; end if;
  select * into student from public.profiles where id = p_student_id and role = 'STUDENT';
  if not found then raise exception using errcode = '42501', message = 'student_only'; end if;
  if p_teacher_id = p_student_id then
    raise exception using errcode = '22023', message = 'invalid_participants';
  end if;
  duration_seconds := extract(epoch from (p_end_at_utc - p_start_at_utc));
  lesson_seconds := teacher.default_lesson_minutes::numeric * 60;
  -- Validate before casting: PostgreSQL casts may round fractional numbers.
  if duration_seconds < lesson_seconds or duration_seconds > lesson_seconds * 8
     or mod(duration_seconds, lesson_seconds) <> 0 then
    raise exception using errcode = '22023', message = 'invalid_lesson_duration';
  end if;
  count_value := (duration_seconds / lesson_seconds)::smallint;
  if exists (
    select 1 from public.teacher_blocked_periods b
    where b.teacher_id = p_teacher_id
      and tstzrange(b.start_at_utc, b.end_at_utc, '[)') && tstzrange(p_start_at_utc, p_end_at_utc, '[)')
  ) then
    raise exception using errcode = '23P01', message = 'teacher_blocked_period';
  end if;
  insert into public.bookings (
    teacher_id, student_id, start_at_utc, end_at_utc, status, lesson_minutes, lesson_count
  ) values (
    p_teacher_id, p_student_id, p_start_at_utc, p_end_at_utc, 'PENDING', teacher.default_lesson_minutes, count_value
  ) returning * into result;
  insert into public.notification_logs (booking_id, recipient_id, notification_type, unique_key)
  values (result.id, p_teacher_id, 'BOOKING_CREATED', 'booking:' || result.id || ':created')
  on conflict (unique_key) do nothing;
  return result;
exception when exclusion_violation then
  raise exception using errcode = '23P01', message = 'slot_unavailable';
end;
$$;

-- Preserve the backend-only RPC boundary, including on fresh installations.
revoke execute on function public.create_booking(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.create_booking(uuid, uuid, timestamptz, timestamptz) to service_role;
