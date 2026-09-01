-- Teachers are available by default. A student may request any future
-- 15-minute boundary that does not overlap a teacher blackout or reserved
-- booking. The existing bookings exclusion constraint remains the final
-- concurrency guard.

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
  result public.bookings;
begin
  if p_start_at_utc <= now() or p_end_at_utc <= p_start_at_utc then
    raise exception using errcode = '22023', message = 'invalid_booking_time';
  end if;
  if extract(minute from p_start_at_utc)::integer % 15 <> 0
     or extract(second from p_start_at_utc)::integer <> 0 then
    raise exception using errcode = '22023', message = 'start_time_must_be_15_minute_boundary';
  end if;
  select * into teacher from public.profiles where id = p_teacher_id and role = 'TEACHER';
  if not found then raise exception using errcode = 'P0002', message = 'teacher_not_found'; end if;
  select * into student from public.profiles where id = p_student_id and role = 'STUDENT';
  if not found then raise exception using errcode = '42501', message = 'student_only'; end if;
  if p_teacher_id = p_student_id then
    raise exception using errcode = '22023', message = 'invalid_participants';
  end if;
  if extract(epoch from (p_end_at_utc - p_start_at_utc)) / 60 <> teacher.default_lesson_minutes then
    raise exception using errcode = '22023', message = 'invalid_lesson_duration';
  end if;
  if exists (
    select 1 from public.teacher_blocked_periods b
    where b.teacher_id = p_teacher_id
      and tstzrange(b.start_at_utc, b.end_at_utc, '[)') && tstzrange(p_start_at_utc, p_end_at_utc, '[)')
  ) then
    raise exception using errcode = '23P01', message = 'teacher_blocked_period';
  end if;
  insert into public.bookings (teacher_id, student_id, start_at_utc, end_at_utc, status)
  values (p_teacher_id, p_student_id, p_start_at_utc, p_end_at_utc, 'PENDING')
  returning * into result;
  insert into public.notification_logs (booking_id, recipient_id, notification_type, unique_key)
  values (result.id, p_teacher_id, 'BOOKING_CREATED', 'booking:' || result.id || ':created')
  on conflict (unique_key) do nothing;
  return result;
exception when exclusion_violation then
  raise exception using errcode = '23P01', message = 'slot_unavailable';
end;
$$;
