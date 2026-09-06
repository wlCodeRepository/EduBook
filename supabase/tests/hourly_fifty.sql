begin;
set local timezone='UTC';
do $$
declare t uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); base timestamptz:=date_trunc('day',now())+interval '60 days'; b public.bookings; n integer; rejected boolean;
begin
 insert into auth.users(id) values(t),(s);
 insert into public.profiles(id,role,display_name,email,timezone,default_lesson_minutes)
 values(t,'TEACHER','Policy test','hourly-teacher@example.invalid','UTC',30),(s,'STUDENT','Policy student','hourly-student@example.invalid','UTC',60);
 if (select default_lesson_minutes from public.profiles where id=t)<>50 then raise exception 'fixed_duration_failed'; end if;
 update public.profiles set default_lesson_minutes=90 where id=t;
 if (select default_lesson_minutes from public.profiles where id=t)<>50 then raise exception 'duration_edit_not_locked'; end if;
 for n in 1..8 loop
  b:=public.create_booking(t,s,base+n*interval '1 day',base+n*interval '1 day'+(n*60-10)*interval '1 minute');
  if b.lesson_minutes<>50 or b.lesson_count<>n or b.break_minutes<>10 then raise exception 'wrong_hourly_snapshot'; end if;
 end loop;
 rejected:=false;
 begin perform public.create_booking(t,s,base+interval '15 minutes',base+interval '65 minutes'); exception when sqlstate '22023' then rejected:=true; end;
 if not rejected then raise exception 'quarter_hour_accepted'; end if;
 rejected:=false;
 begin perform public.create_booking(t,s,base,base+interval '100 minutes'); exception when sqlstate '22023' then rejected:=true; end;
 if not rejected then raise exception 'missing_break_accepted'; end if;
 rejected:=false;
 begin perform public.create_booking(t,s,base+interval '2 days 1 hour',base+interval '2 days 1 hour 50 minutes'); exception when sqlstate '23P01' then rejected:=true; end;
 if not rejected then raise exception 'overlap_accepted'; end if;
 -- Legacy/block conflict solely in the reserved inter-lesson break still blocks.
 insert into public.teacher_blocked_periods(teacher_id,start_at_utc,end_at_utc,reason) values(t,base+interval '50 minutes',base+interval '60 minutes','test');
 rejected:=false;
 begin perform public.create_booking(t,s,base,base+interval '110 minutes'); exception when sqlstate '23P01' then rejected:=true; end;
 if not rejected then raise exception 'break_conflict_accepted'; end if;
 b:=public.create_booking(t,s,base,base+interval '50 minutes');
 if b.lesson_count<>1 then raise exception 'adjacency_rejected'; end if;
 if has_function_privilege('authenticated','public.create_booking(uuid,uuid,timestamptz,timestamptz)','EXECUTE') then raise exception 'rpc_access_expanded'; end if;
end;
$$;
rollback;
