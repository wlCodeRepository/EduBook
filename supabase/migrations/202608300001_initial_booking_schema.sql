-- EduBook initial booking schema.
-- All concrete appointment timestamps are stored as timestamptz (UTC by PostgreSQL).

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create type public.user_role as enum ('STUDENT', 'TEACHER');
create type public.booking_status as enum (
  'PENDING',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED'
);

-- pg_timezone_names is the source of truth for IANA timezone identifiers.
create or replace function public.is_valid_timezone(value text)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from pg_timezone_names
    where name = value
  );
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  email text not null,
  timezone text not null default 'UTC',
  default_lesson_minutes smallint not null default 60 check (default_lesson_minutes between 5 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_timezone_check check (public.is_valid_timezone(timezone))
);

create table public.teacher_availability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  local_start_time time not null,
  local_end_time time not null,
  effective_from date,
  effective_until date,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint availability_time_order check (local_end_time > local_start_time),
  constraint availability_date_order check (
    effective_until is null or effective_from is null or effective_until >= effective_from
  )
);

create table public.teacher_blocked_periods (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  start_at_utc timestamptz not null,
  end_at_utc timestamptz not null,
  reason text check (reason is null or length(btrim(reason)) <= 500),
  created_at timestamptz not null default now(),
  constraint blocked_period_time_order check (end_at_utc > start_at_utc)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  start_at_utc timestamptz not null,
  end_at_utc timestamptz not null,
  status public.booking_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  cancellation_reason text check (
    cancellation_reason is null or length(btrim(cancellation_reason)) <= 500
  ),
  constraint booking_time_order check (end_at_utc > start_at_utc),
  constraint booking_participants_distinct check (teacher_id <> student_id),
  constraint booking_confirmation_timestamp check (
    status <> 'CONFIRMED' or confirmed_at is not null
  ),
  constraint booking_rejection_timestamp check (
    status <> 'REJECTED' or rejected_at is not null
  ),
  constraint booking_completion_timestamp check (
    status <> 'COMPLETED' or completed_at is not null
  ),
  constraint booking_cancellation_timestamp check (
    status <> 'CANCELLED' or cancelled_at is not null
  )
);

-- A pending request reserves the slot. Half-open ranges allow adjacent lessons.
alter table public.bookings
  add constraint bookings_teacher_active_time_exclusion
  exclude using gist (
    teacher_id with =,
    tstzrange(start_at_utc, end_at_utc, '[)') with &&
  ) where (status in ('PENDING', 'CONFIRMED'));

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null check (
    notification_type in (
      'BOOKING_CREATED',
      'BOOKING_CONFIRMED',
      'BOOKING_REJECTED',
      'BOOKING_CANCELLED',
      'BOOKING_REMINDER'
    )
  ),
  unique_key text not null unique,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  error_message text,
  sent_at timestamptz,
  claimed_at timestamptz,
  claim_token text,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now()
);

create index teacher_availability_teacher_weekday_idx
  on public.teacher_availability (teacher_id, weekday, enabled);
create index teacher_blocked_periods_teacher_time_idx
  on public.teacher_blocked_periods using gist
    (teacher_id, tstzrange(start_at_utc, end_at_utc, '[)'));
create index bookings_student_created_idx
  on public.bookings (student_id, created_at desc);
create index bookings_teacher_status_start_idx
  on public.bookings (teacher_id, status, start_at_utc);
create index notification_logs_pending_idx
  on public.notification_logs (status, created_at)
  where status in ('PENDING', 'FAILED');
create index notification_logs_claim_idx
  on public.notification_logs (claim_token)
  where claim_token is not null;

-- Keep updated_at database-managed for profile changes.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.teacher_availability enable row level security;
alter table public.teacher_blocked_periods enable row level security;
alter table public.bookings enable row level security;
alter table public.notification_logs enable row level security;

create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy availability_select_authenticated on public.teacher_availability
  for select to authenticated using (true);
create policy availability_teacher_insert on public.teacher_availability
  for insert to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'TEACHER')
  );
create policy availability_teacher_update on public.teacher_availability
  for update to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy availability_teacher_delete on public.teacher_availability
  for delete to authenticated using (teacher_id = auth.uid());

create policy blocked_select_authenticated on public.teacher_blocked_periods
  for select to authenticated using (true);
create policy blocked_teacher_insert on public.teacher_blocked_periods
  for insert to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'TEACHER')
  );
create policy blocked_teacher_update on public.teacher_blocked_periods
  for update to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy blocked_teacher_delete on public.teacher_blocked_periods
  for delete to authenticated using (teacher_id = auth.uid());

create policy bookings_student_select on public.bookings
  for select to authenticated using (student_id = auth.uid());
create policy bookings_teacher_select on public.bookings
  for select to authenticated using (teacher_id = auth.uid());
create policy bookings_student_insert on public.bookings
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and status = 'PENDING'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'STUDENT')
  );
-- Status changes are intentionally reserved for Edge Functions using the service role.

create policy notification_logs_recipient_select on public.notification_logs
  for select to authenticated using (recipient_id = auth.uid());

-- All booking validation is performed in one transaction. The function is
-- SECURITY DEFINER so callers cannot bypass the rules with a crafted slot.
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
  local_start timestamp;
  local_end timestamp;
  local_date date;
  local_weekday integer;
  result public.bookings;
begin
  if p_start_at_utc <= now() or p_end_at_utc <= p_start_at_utc then
    raise exception using errcode = '22023', message = 'invalid_booking_time';
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

  local_start := p_start_at_utc at time zone teacher.timezone;
  local_end := p_end_at_utc at time zone teacher.timezone;
  local_date := local_start::date;
  local_weekday := extract(dow from local_start)::integer;
  if local_start::date <> local_end::date then
    raise exception using errcode = '22023', message = 'slot_crosses_local_day';
  end if;

  if not exists (
    select 1 from public.teacher_availability a
    where a.teacher_id = p_teacher_id and a.enabled
      and a.weekday = local_weekday
      and (a.effective_from is null or local_date >= a.effective_from)
      and (a.effective_until is null or local_date <= a.effective_until)
      and local_start::time >= a.local_start_time
      and local_end::time <= a.local_end_time
  ) then
    raise exception using errcode = '22023', message = 'outside_teacher_availability';
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

-- Conditional UPDATE is the concurrency boundary: no read-before-write is
-- used to decide whether a transition is still allowed.
create or replace function public.apply_booking_action(
  p_booking_id uuid,
  p_teacher_id uuid,
  p_action text,
  p_cancellation_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  expected public.booking_status;
  next_status public.booking_status;
  result public.bookings;
  now_value timestamptz := now();
begin
  if p_action = 'confirm' then expected := 'PENDING'; next_status := 'CONFIRMED';
  elsif p_action = 'reject' then expected := 'PENDING'; next_status := 'REJECTED';
  elsif p_action = 'cancel' then expected := 'CONFIRMED'; next_status := 'CANCELLED';
  else raise exception using errcode = '22023', message = 'invalid_action'; end if;
  if p_cancellation_reason is not null and length(btrim(p_cancellation_reason)) > 500 then
    raise exception using errcode = '22023', message = 'invalid_cancellation_reason';
  end if;

  update public.bookings
  set status = next_status,
      confirmed_at = case when next_status = 'CONFIRMED' then now_value else confirmed_at end,
      rejected_at = case when next_status = 'REJECTED' then now_value else rejected_at end,
      cancelled_at = case when next_status = 'CANCELLED' then now_value else cancelled_at end,
      cancellation_reason = case when next_status = 'CANCELLED' then nullif(btrim(p_cancellation_reason), '') else cancellation_reason end
  where id = p_booking_id and teacher_id = p_teacher_id and status = expected
  returning * into result;
  if not found then raise exception using errcode = 'P0002', message = 'booking_not_found_or_transition_conflict'; end if;

  insert into public.notification_logs (booking_id, recipient_id, notification_type, unique_key)
  values (
    result.id, result.student_id,
    case next_status when 'CONFIRMED' then 'BOOKING_CONFIRMED' when 'REJECTED' then 'BOOKING_REJECTED' else 'BOOKING_CANCELLED' end,
    'booking:' || result.id || ':' || lower(next_status::text)
  ) on conflict (unique_key) do nothing;
  return result;
end;
$$;

create or replace function public.claim_due_reminders(
  p_from timestamptz, p_until timestamptz, p_limit integer default 100
)
returns table (id uuid, booking_id uuid, recipient_id uuid, recipient_email text, recipient_timezone text, start_at_utc timestamptz, claim_token text)
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  insert into public.notification_logs (booking_id, recipient_id, notification_type, unique_key)
  select b.id, recipient.id, 'BOOKING_REMINDER', 'booking:' || b.id || ':reminder-1h:' || recipient.id
  from public.bookings b
  cross join lateral (select p.id, p.email from public.profiles p where p.id in (b.student_id, b.teacher_id)) recipient
  where b.status = 'CONFIRMED' and b.start_at_utc >= p_from and b.start_at_utc < p_until
  on conflict (unique_key) do nothing;

  return query
  with candidates as (
    select n.id
    from public.notification_logs n
    where n.notification_type = 'BOOKING_REMINDER'
      and n.status in ('PENDING', 'FAILED')
      and (n.claimed_at is null or n.claimed_at < now() - interval '10 minutes')
    order by n.created_at
    limit greatest(1, least(p_limit, 500))
    for update skip locked
  ), claimed as (
    update public.notification_logs n
    set claimed_at = now(), claim_token = gen_random_uuid()::text, attempts = n.attempts + 1
    from candidates c where n.id = c.id
    returning n.*
  )
  select c.id, c.booking_id, c.recipient_id, p.email, p.timezone, b.start_at_utc, c.claim_token
  from claimed c join public.profiles p on p.id = c.recipient_id join public.bookings b on b.id = c.booking_id;
end;
$$;

create or replace function public.complete_notification_claim(p_claim_token text, p_success boolean, p_error text default null)
returns integer language sql security definer set search_path = pg_catalog, public as $$
  update public.notification_logs
  set status = case when p_success then 'SENT' else 'FAILED' end,
      sent_at = case when p_success then now() else sent_at end,
      error_message = case when p_success then null else left(p_error, 1000) end,
      claimed_at = null, claim_token = null
  where claim_token = p_claim_token
  returning 1;
$$;

create or replace function public.archive_expired_bookings()
returns integer language sql security definer set search_path = pg_catalog, public as $$
  with updated as (
    update public.bookings set status = 'COMPLETED', completed_at = now()
    where status = 'CONFIRMED' and end_at_utc <= now()
    returning 1
  ) select count(*)::integer from updated;
$$;

-- These RPCs are backend-only. The browser must not be able to invoke a
-- SECURITY DEFINER function with an arbitrary participant or teacher id.
revoke execute on function public.create_booking(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.apply_booking_action(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.claim_due_reminders(timestamptz, timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.complete_notification_claim(text, boolean, text) from public, anon, authenticated;
revoke execute on function public.archive_expired_bookings() from public, anon, authenticated;
grant execute on function public.create_booking(uuid, uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.apply_booking_action(uuid, uuid, text, text) to service_role;
grant execute on function public.claim_due_reminders(timestamptz, timestamptz, integer) to service_role;
grant execute on function public.complete_notification_claim(text, boolean, text) to service_role;
grant execute on function public.archive_expired_bookings() to service_role;

comment on table public.bookings is 'Concrete appointment times are UTC timestamptz; PENDING and CONFIRMED reserve the teacher range.';
comment on column public.profiles.timezone is 'IANA timezone identifier used only for display and local weekly-rule interpretation.';
