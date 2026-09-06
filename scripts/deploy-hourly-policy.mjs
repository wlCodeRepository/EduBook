// Explicit, manually dispatched migration. Never print credentials or row data.
import {readFile} from 'node:fs/promises';
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token)throw new Error('Missing deployment credential');
const endpoint='https://api.supabase.com/v1/projects/ahhmaiazcimegsuihnrg/database/query';
async function query(sql){
 const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql})});
 if(!response.ok)throw new Error(`Database management request failed: HTTP ${response.status}`);
 return response.json();
}
const state=await query("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='break_minutes') as applied");
if(!state[0]?.applied){
 const migration=await readFile('supabase/migrations/202609060001_hourly_fifty.sql','utf8');
 await query(`begin;
 create schema if not exists edubook_release_backup;
 revoke all on schema edubook_release_backup from public,anon,authenticated;
 create table edubook_release_backup.hourly_20260906_function as select pg_get_functiondef('public.create_booking(uuid,uuid,timestamptz,timestamptz)'::regprocedure) as definition;
 create table edubook_release_backup.hourly_20260906_profiles as select id,default_lesson_minutes from public.profiles where role='TEACHER';
 create table edubook_release_backup.hourly_20260906_bookings as select id,start_at_utc,end_at_utc,lesson_minutes,lesson_count from public.bookings;
 ${migration}
 do $$ begin
 if exists(select 1 from edubook_release_backup.hourly_20260906_bookings old left join public.bookings b using(id) where b.id is null or row(old.start_at_utc,old.end_at_utc,old.lesson_minutes,old.lesson_count) is distinct from row(b.start_at_utc,b.end_at_utc,b.lesson_minutes,b.lesson_count)) then raise exception 'Historical data changed'; end if;
 end $$;
 commit;`);
 console.log('Hourly policy migration committed; historical times preserved.');
}else console.log('Policy column already exists; migration not replayed.');
await query(await readFile('supabase/tests/hourly_fifty.sql','utf8'));
console.log('PASS: hourly start, duration, breaks, overlap, adjacency, fixed profile, RPC permission. Test fixtures rolled back.');
