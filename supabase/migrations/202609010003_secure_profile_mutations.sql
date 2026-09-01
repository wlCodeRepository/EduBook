-- Browser clients must never create identities or change authorization fields.
-- Profile roles and usernames are controlled by the administrator-only Edge Function.

drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;

revoke insert, update, delete on public.profiles from authenticated;
revoke insert, update, delete on public.bookings from authenticated;

create or replace function public.update_my_profile(
  p_display_name text,
  p_timezone text,
  p_default_lesson_minutes smallint
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'unauthorized';
  end if;
  if p_display_name is null or length(btrim(p_display_name)) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'invalid_display_name';
  end if;
  if p_timezone is null or not public.is_valid_timezone(p_timezone) then
    raise exception using errcode = '22023', message = 'invalid_timezone';
  end if;
  if p_default_lesson_minutes is null or p_default_lesson_minutes not between 5 and 240 then
    raise exception using errcode = '22023', message = 'invalid_lesson_duration';
  end if;

  update public.profiles
  set display_name = btrim(p_display_name),
      timezone = p_timezone,
      default_lesson_minutes = p_default_lesson_minutes
  where id = auth.uid()
  returning * into result;

  if not found then
    raise exception using errcode = 'P0002', message = 'profile_not_found';
  end if;
  return result;
end;
$$;

revoke all on function public.update_my_profile(text, text, smallint) from public, anon;
grant execute on function public.update_my_profile(text, text, smallint) to authenticated;

create or replace function public.list_teacher_busy_slots(
  p_teacher_id uuid,
  p_from timestamptz,
  p_until timestamptz
)
returns table (start_at_utc timestamptz, end_at_utc timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_teacher_id is null or p_from is null or p_until is null
     or p_until <= p_from or p_until > p_from + interval '31 days' then
    raise exception using errcode = '22023', message = 'invalid_busy_slot_range';
  end if;
  return query
  select b.start_at_utc, b.end_at_utc
  from public.bookings b
  where b.teacher_id = p_teacher_id
    and b.status in ('PENDING', 'CONFIRMED')
    and tstzrange(b.start_at_utc, b.end_at_utc, '[)') && tstzrange(p_from, p_until, '[)');
end;
$$;

revoke all on function public.list_teacher_busy_slots(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.list_teacher_busy_slots(uuid, timestamptz, timestamptz) to service_role;
