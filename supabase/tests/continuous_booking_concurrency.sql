-- Disposable database only, after all migrations. Requires dblink and a local
-- PostgreSQL connection for the current admin user (libpq socket / pg_hba).
-- Remote fixtures are committed so two sessions can see them, then cleaned up.
\set ON_ERROR_STOP on
begin;
create extension if not exists dblink;
do $$
declare
  teacher uuid := gen_random_uuid();
  student uuid := gen_random_uuid();
  starts timestamptz := date_trunc('day', now()) + interval '60 days';
  booking_sql text;
  cleanup_sql text;
  blocked boolean := false;
  loser_state text;
  loser_message text;
  rows_count bigint;
  n integer;
begin
  perform dblink_connect('continuous_a', format('dbname=%L user=%L application_name=continuous_booking_a', current_database(), current_user));
  perform dblink_connect('continuous_b', format('dbname=%L user=%L application_name=continuous_booking_b', current_database(), current_user));
  cleanup_sql := format('delete from public.notification_logs where booking_id in (select id from public.bookings where teacher_id=%L);
    delete from public.bookings where teacher_id=%L;
    delete from public.profiles where id in (%L,%L);
    delete from auth.users where id in (%L,%L)', teacher, teacher, teacher, student, teacher, student);
  begin
    perform dblink_exec('continuous_a', format('insert into auth.users(id) values (%L),(%L);
      insert into public.profiles(id,role,display_name,email) values
      (%L,''TEACHER'',''Concurrent Teacher'',''concurrent-teacher@example.invalid''),
      (%L,''STUDENT'',''Concurrent Student'',''concurrent-student@example.invalid'')', teacher, student, teacher, student));
    perform dblink_exec('continuous_a', 'begin');
    booking_sql := format('select (public.create_booking(%L,%L,%L,%L)).id', teacher, student, starts, starts + interval '8 hours');
    perform * from dblink('continuous_a', booking_sql) as booked(id uuid);
    -- Second request hits only the last lesson of the uncommitted interval.
    booking_sql := format('select (public.create_booking(%L,%L,%L,%L)).id', teacher, student, starts + interval '7 hours', starts + interval '8 hours');
    perform dblink_send_query('continuous_b', booking_sql);
    for n in 1..100 loop
      perform pg_stat_clear_snapshot();
      select exists (select 1 from pg_stat_activity
        where application_name = 'continuous_booking_b' and wait_event_type = 'Lock') into blocked;
      exit when blocked;
      perform pg_sleep(0.05);
    end loop;
    if not blocked then raise exception 'Second session did not wait on uncommitted booking'; end if;
    perform dblink_exec('continuous_a', 'commit');
    begin
      perform * from dblink_get_result('continuous_b') as booked(id uuid);
    exception when others then
      get stacked diagnostics loser_state = returned_sqlstate, loser_message = message_text;
    end;
    if loser_state is distinct from '23P01' or loser_message is distinct from 'slot_unavailable' then
      raise exception 'Expected concurrent slot_unavailable, got % / %', loser_state, loser_message;
    end if;
    select total into rows_count from dblink('continuous_a', format('select count(*) from public.bookings where teacher_id=%L', teacher)) as counts(total bigint);
    if rows_count <> 1 then raise exception 'Concurrent requests created % bookings', rows_count; end if;
    select total into rows_count from dblink('continuous_a', format('select count(*) from public.notification_logs where recipient_id=%L', teacher)) as counts(total bigint);
    if rows_count <> 1 then raise exception 'Losing request left notification side effects'; end if;
    perform dblink_exec('continuous_a', cleanup_sql);
  exception when others then
    perform dblink_exec('continuous_a', 'rollback');
    perform dblink_disconnect('continuous_b');
    perform dblink_exec('continuous_a', cleanup_sql);
    perform dblink_disconnect('continuous_a');
    raise;
  end;
  perform dblink_disconnect('continuous_b');
  perform dblink_disconnect('continuous_a');
end;
$$;
rollback;
