-- Run with psql -X -v ON_ERROR_STOP=1 -f after all migrations, in a disposable DB.
-- No pgTAP dependency; every failed assertion aborts, all fixtures roll back.
begin;
set local timezone = 'UTC';

create function pg_temp.expect_error(statement text, expected_state text, expected_message text default null)
returns void language plpgsql as $$
declare actual_state text; actual_message text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual_state = returned_sqlstate, actual_message = message_text;
  end;
  if actual_state is distinct from expected_state
     or (expected_message is not null and actual_message is distinct from expected_message) then
    raise exception 'Expected % / %, got % / % for %',
      expected_state, expected_message, actual_state, actual_message, statement;
  end if;
end;
$$;

do $$
declare
  teacher uuid := gen_random_uuid();
  student uuid := gen_random_uuid();
  base timestamptz := date_trunc('day', now()) + interval '30 days';
  starts timestamptz;
  booked public.bookings;
  first_booking public.bookings;
  n integer;
  minutes numeric;
  sql text;
begin
  insert into auth.users(id) values (teacher), (student);
  insert into public.profiles(id, role, display_name, email, default_lesson_minutes)
  values (teacher, 'TEACHER', 'SQL Teacher', 'sql-teacher@example.invalid', 45),
         (student, 'STUDENT', 'SQL Student', 'sql-student@example.invalid', 60);

  execute 'set local role service_role';

  for n in 1..8 loop
    starts := base + n * interval '1 day' + interval '23 hours 45 minutes';
    booked := public.create_booking(teacher, student, starts, starts + n * interval '45 minutes');
    if booked.lesson_count <> n or booked.lesson_minutes <> 45
       or booked.start_at_utc <> starts or booked.end_at_utc <> starts + n * interval '45 minutes'
       or booked.status <> 'PENDING' then
      raise exception 'Wrong interval or snapshot for % lessons', n;
    end if;
    if (select count(*) from public.notification_logs where booking_id = booked.id) <> 1 then
      raise exception 'Expected exactly one notification per complete booking';
    end if;
    if n = 1 then first_booking := booked; end if;
  end loop;
  if (select count(*) from public.bookings where teacher_id = teacher) <> 8 then
    raise exception 'Each interval must be a single booking row';
  end if;

  foreach minutes in array array[0, -45, 44, 46, 67.5, 405]::numeric[] loop
    perform pg_temp.expect_error(format('select public.create_booking(%L,%L,%L,%L)',
      teacher, student, base, base + minutes * interval '1 minute'), '22023');
  end loop;
  perform pg_temp.expect_error(format('select public.create_booking(%L,%L,null,%L)', teacher, student, base), '22023', 'invalid_booking_time');
  perform pg_temp.expect_error(format('select public.create_booking(%L,%L,%L,null)', teacher, student, base), '22023', 'invalid_booking_time');
  perform pg_temp.expect_error(format('select public.create_booking(%L,%L,%L,%L)', teacher, student, '-infinity', base), '22023', 'invalid_booking_time');
  perform pg_temp.expect_error(format('select public.create_booking(%L,%L,%L,%L)', teacher, student, base, 'infinity'), '22023', 'invalid_booking_time');
  perform pg_temp.expect_error(format('select public.create_booking(%L,%L,%L,%L)', teacher, student, now() - interval '1 day', now()), '22023', 'invalid_booking_time');
  foreach minutes in array array[1, 0.001]::numeric[] loop
    starts := base + minutes * interval '1 minute';
    perform pg_temp.expect_error(format('select public.create_booking(%L,%L,%L,%L)', teacher, student, starts, starts + interval '45 minutes'), '22023', 'start_time_must_be_15_minute_boundary');
  end loop;
  perform pg_temp.expect_error(format('select public.create_booking(%L,%L,%L,%L)', gen_random_uuid(), student, base, base + interval '45 minutes'), 'P0002', 'teacher_not_found');
  perform pg_temp.expect_error(format('select public.create_booking(%L,%L,%L,%L)', teacher, teacher, base, base + interval '45 minutes'), '42501', 'student_only');

  -- A blackout in the second lesson rejects the whole request. Adjacency is OK.
  insert into public.teacher_blocked_periods(teacher_id, start_at_utc, end_at_utc)
  values (teacher, base + interval '60 minutes', base + interval '75 minutes');
  perform pg_temp.expect_error(format('select public.create_booking(%L,%L,%L,%L)', teacher, student, base, base + interval '90 minutes'), '23P01', 'slot_unavailable');
  booked := public.create_booking(teacher, student, base + interval '75 minutes', base + interval '120 minutes');

  -- Pending and confirmed reserve the entire interval, including its final lesson.
  sql := format('select public.create_booking(%L,%L,%L,%L)', teacher, student,
    first_booking.start_at_utc - interval '45 minutes', first_booking.end_at_utc);
  perform pg_temp.expect_error(sql, '23P01', 'slot_unavailable');
  perform public.apply_booking_action(first_booking.id, teacher, 'confirm');
  perform pg_temp.expect_error(sql, '23P01', 'slot_unavailable');
  booked := public.create_booking(teacher, student, first_booking.end_at_utc, first_booking.end_at_utc + interval '90 minutes');
  perform public.apply_booking_action(first_booking.id, teacher, 'cancel');
  booked := public.create_booking(teacher, student, first_booking.start_at_utc, first_booking.end_at_utc);

  update public.profiles set default_lesson_minutes = 30 where id = teacher;
  select * into booked from public.bookings where id = first_booking.id;
  if booked.lesson_minutes <> 45 or booked.lesson_count <> 1 then
    raise exception 'Teacher setting must not rewrite snapshots';
  end if;
  booked := public.create_booking(teacher, student, base + interval '20 days', base + interval '20 days 4 hours');
  if booked.lesson_minutes <> 30 or booked.lesson_count <> 8 then raise exception 'New setting ignored'; end if;
  perform pg_temp.expect_error(format('update public.bookings set lesson_count = 9 where id = %L', booked.id), '23514');
  perform pg_temp.expect_error(format('update public.bookings set lesson_count = 0 where id = %L', booked.id), '23514');
  perform pg_temp.expect_error(format('update public.bookings set lesson_minutes = null where id = %L', booked.id), '23502');
  perform pg_temp.expect_error(format('update public.bookings set lesson_minutes = 31 where id = %L', booked.id), '23514');

  -- Teacher configuration extremes, including an interval longer than one day.
  foreach n in array array[5, 240] loop
    update public.profiles set default_lesson_minutes = n where id = teacher;
    starts := base + (30 + n) * interval '1 day';
    booked := public.create_booking(teacher, student, starts, starts + (n * 8) * interval '1 minute');
    if booked.lesson_minutes <> n or booked.lesson_count <> 8 then
      raise exception 'Teacher duration bound failed: %', n;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.create_booking(uuid,uuid,timestamptz,timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.create_booking(uuid,uuid,timestamptz,timestamptz)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.create_booking(uuid,uuid,timestamptz,timestamptz)', 'EXECUTE')
     or has_table_privilege('authenticated', 'public.bookings', 'INSERT') then
    raise exception 'Backend-only authorization changed';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.bookings'::regclass
    and conname = 'bookings_teacher_active_time_exclusion' and contype = 'x') then
    raise exception 'Concurrency exclusion constraint missing';
  end if;
end;
$$;
set local role anon;
select pg_temp.expect_error('select public.create_booking(null,null,null,null)', '42501', 'permission denied for function create_booking');
set local role authenticated;
select pg_temp.expect_error('select public.create_booking(null,null,null,null)', '42501', 'permission denied for function create_booking');
rollback;
