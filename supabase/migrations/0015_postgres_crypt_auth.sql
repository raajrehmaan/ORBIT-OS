create extension if not exists pgcrypto;

create or replace function public.hash_auth_password(input_password text)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select crypt(input_password, gen_salt('bf'));
$$;

create or replace function public.verify_auth_user_password(input_username text, input_password text)
returns table (
  id uuid,
  username text,
  role text,
  organisation_id uuid,
  active boolean,
  full_name text
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    au.id,
    au.username,
    au.role,
    au.organisation_id,
    au.active,
    u.full_name
  from public.auth_users au
  left join public.users u on u.id = au.id and u.organisation_id = au.organisation_id
  where lower(au.username) = lower(input_username)
    and au.active = true
    and au.password_hash = crypt(input_password, au.password_hash)
  limit 1;
$$;

revoke all on function public.hash_auth_password(text) from public;
revoke all on function public.verify_auth_user_password(text, text) from public;
grant execute on function public.hash_auth_password(text) to authenticated;
grant execute on function public.hash_auth_password(text) to service_role;
grant execute on function public.verify_auth_user_password(text, text) to anon;
grant execute on function public.verify_auth_user_password(text, text) to authenticated;
grant execute on function public.verify_auth_user_password(text, text) to service_role;

notify pgrst, 'reload schema';
