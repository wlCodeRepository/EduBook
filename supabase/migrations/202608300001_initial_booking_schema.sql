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

comment on table public.bookings is 'Concrete appointment times are UTC timestamptz; PENDING and CONFIRMED reserve the teacher range.';
comment on column public.profiles.timezone is 'IANA timezone identifier used only for display and local weekly-rule interpretation.';
