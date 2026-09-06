-- Fixed hourly policy. Apply as one transaction; old booking times are never rewritten.
alter table public.bookings add column break_minutes smallint not null default 0 check (break_minutes in (0,10));
alter table public.bookings drop constraint bookings_lesson_interval_check;
alter table public.bookings add constraint bookings_lesson_interval_check check (
  isfinite(start_at_utc) and isfinite(end_at_utc) and
  lesson_minutes * lesson_count + break_minutes * (lesson_count-1) =
    extract(epoch from (end_at_utc-start_at_utc))/60
);
comment on column public.bookings.break_minutes is 'Booking snapshot: 0 for legacy rows, 10 between new fifty-minute lessons. Entire interval is reserved.';
comment on column public.bookings.lesson_minutes is 'Booking-time teaching minutes per lesson; new hourly bookings use 50, legacy snapshots unchanged.';
create or replace function public.fixed_teacher_lesson_duration()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if new.role='TEACHER' then new.default_lesson_minutes := 50; end if;
  return new;
end;
$$;
revoke all on function public.fixed_teacher_lesson_duration() from public,anon,authenticated;
create trigger fixed_teacher_lesson_duration before insert or update on public.profiles
for each row execute function public.fixed_teacher_lesson_duration();
update public.profiles set default_lesson_minutes=50 where role='TEACHER';
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
  idx integer;
  count_value smallint;
  result public.bookings;
begin
  if p_start_at_utc is null or p_end_at_utc is null
     or not isfinite(p_start_at_utc) or not isfinite(p_end_at_utc)
     or p_start_at_utc <= now() or p_end_at_utc <= p_start_at_utc then
    raise exception using errcode = '22023', message = 'invalid_booking_time';
  end if;
  select * into teacher from public.profiles where id = p_teacher_id and role = 'TEACHER';
  if not found then raise exception using errcode = 'P0002', message = 'teacher_not_found'; end if;
  select * into student from public.profiles where id = p_student_id and role = 'STUDENT';
  if not found then raise exception using errcode = '42501', message = 'student_only'; end if;
  if p_teacher_id = p_student_id then
    raise exception using errcode = '22023', message = 'invalid_participants';
  end if;
  duration_seconds := extract(epoch from (p_end_at_utc - p_start_at_utc));
  lesson_seconds := 3600;
  -- Validate before casting: PostgreSQL casts may round fractional numbers.
  if duration_seconds < 3000 or duration_seconds > 28200
     or mod(duration_seconds + 600, lesson_seconds) <> 0 then
    raise exception using errcode = '22023', message = 'invalid_lesson_duration';
  end if;
  count_value := ((duration_seconds + 600) / lesson_seconds)::smallint;
  for idx in 0..count_value-1 loop
    if extract(minute from ((p_start_at_utc + idx * interval '1 hour') at time zone teacher.timezone)) <> 0
       or extract(second from p_start_at_utc) <> 0 then
      raise exception using errcode = '22023', message = 'start_time_must_be_teacher_hour';
    end if;
  end loop;
  if exists (
    select 1 from public.teacher_blocked_periods b
    where b.teacher_id = p_teacher_id
      and tstzrange(b.start_at_utc, b.end_at_utc, '[)') && tstzrange(p_start_at_utc, p_end_at_utc, '[)')
  ) then
    raise exception using errcode = '23P01', message = 'teacher_blocked_period';
  end if;
  insert into public.bookings (
    teacher_id, student_id, start_at_utc, end_at_utc, status, lesson_minutes, lesson_count, break_minutes
  ) values (
    p_teacher_id, p_student_id, p_start_at_utc, p_end_at_utc, 'PENDING', 50, count_value, 10
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
