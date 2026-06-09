create table if not exists public.auth_users (
  id uuid primary key references public.users(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  username text not null,
  password_hash text not null,
  role text not null default 'staff' check (role in ('admin', 'staff', 'receptionist')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, username)
);

create index if not exists auth_users_organisation_id_idx on public.auth_users (organisation_id);
create index if not exists auth_users_username_idx on public.auth_users (username);

drop trigger if exists set_auth_users_updated_at on public.auth_users;
create trigger set_auth_users_updated_at
before update on public.auth_users
for each row execute function public.set_updated_at();

alter table public.auth_users enable row level security;

drop policy if exists "admins manage clinic auth users" on public.auth_users;
create policy "admins manage clinic auth users" on public.auth_users
for all
using (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]))
with check (public.has_min_role(organisation_id, array['organisation_owner', 'admin']::public.app_role[]));

-- Optional bootstrap for existing clinics:
-- Creates a username login for the first owner/admin profile in each organisation
-- only when the organisation has no auth_users rows yet.
-- Bcrypt/crypt-compatible password hash below is for: ChangeMe123!
-- Change this password immediately after first login.
insert into public.auth_users (id, organisation_id, username, password_hash, role, active)
select distinct on (u.organisation_id)
  u.id,
  u.organisation_id,
  lower(regexp_replace(split_part(u.email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g')),
  '$2b$10$5eSuhRAXwAhhz.4WKfXftuizIcI5ITHVBCdyJNpKdz9ZlVkGO6Ee6',
  'admin',
  true
from public.users u
where u.organisation_id is not null
  and u.role in ('organisation_owner', 'admin', 'super_admin')
  and not exists (
    select 1
    from public.auth_users au
    where au.organisation_id = u.organisation_id
  )
order by u.organisation_id, u.created_at asc;

select pg_notify('pgrst', 'reload schema');
