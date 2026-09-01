-- Administrator-managed accounts: users sign in with a username and password.
-- The internal auth email is synthetic and must never be used for delivery.

alter type public.user_role add value if not exists 'ADMIN';

alter table public.profiles add column if not exists username text;

update public.profiles
set username = lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_.-]', '', 'g'))
where username is null;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

alter table public.profiles
  add constraint profiles_username_format_check
  check (username is null or username ~ '^[a-zA-Z0-9_.-]{3,40}$');

comment on column public.profiles.username is 'Login identifier created by an administrator; email is an internal Supabase Auth identity only.';
